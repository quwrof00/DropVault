import { useState, useCallback, useEffect, useRef } from "react";
import { View, Text, FlatList, Pressable, RefreshControl, Alert, ActivityIndicator, Modal, TextInput, Linking, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { FileText, Image as ImageIcon, Film, Music, Code, Box, File as FileIcon, EllipsisVertical, MessageCircle } from "lucide-react-native";
import ScreenHeader from "../../components/ScreenHeader";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useItemCounts } from "../../lib/useItemCounts";
import ItemDiscussion from "../../components/ItemDiscussion";
import * as Clipboard from "expo-clipboard";
import { base64ToUint8Array } from "../../lib/base64";

type FileEntry = {
    name: string;
    id: string; // just to have a key, usually name is unique in folder
    size?: number;
    updated_at: string;
    mimetype?: string;
};

const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const getFileIcon = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();

    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || '')) return <ImageIcon size={24} color="#a78bfa" />;
    if (['mp4', 'mov', 'avi'].includes(ext || '')) return <Film size={24} color="#4ade80" />;
    if (['mp3', 'wav'].includes(ext || '')) return <Music size={24} color="#f472b6" />;
    if (['js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'py'].includes(ext || '')) return <Code size={24} color="#60a5fa" />;
    if (['zip', 'rar', '7z'].includes(ext || '')) return <Box size={24} color="#facc15" />;

    return <FileIcon size={24} color="#94a3b8" />;
};

type FilesContentProps = {
    roomId?: string;
    embedded?: boolean;
    registerAddAction?: (action: (() => void) | null) => void;
};

export default function FilesScreen() {
    return <FilesContent />;
}

export function FilesContent({ roomId, embedded = false, registerAddAction }: FilesContentProps) {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [isActionModalVisible, setIsActionModalVisible] = useState(false);
    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
    const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
    const [isRenameModalVisible, setIsRenameModalVisible] = useState(false);
    const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null);
    const [renameValue, setRenameValue] = useState("");
    const [renaming, setRenaming] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedDiscussionFile, setExpandedDiscussionFile] = useState<string | null>(null);
    const autoUploadTriggeredRef = useRef(false);
    const storageBasePathRef = useRef<string | null>(null);
    const itemCounts = useItemCounts(roomId, "file");

    const getStorageBasePath = async () => {
        if (storageBasePathRef.current) return storageBasePathRef.current;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not found");

        const basePath = roomId ? `room-${roomId}` : user.id;
        storageBasePathRef.current = basePath;
        return basePath;
    };

    const fetchFiles = async () => {
        try {
            const folderPath = await getStorageBasePath();
            const { data, error } = await supabase.storage
                .from("user-files")
                .list(folderPath, {
                    limit: 100,
                    offset: 0,
                    sortBy: { column: 'updated_at', order: 'desc' },
                });

            if (error) throw error;

            const formattedFiles: FileEntry[] = data.map(file => ({
                name: file.name,
                id: file.id || file.name,
                size: file.metadata?.size,
                updated_at: file.updated_at || new Date().toISOString(),
                mimetype: file.metadata?.mimetype
            }));

            setFiles(formattedFiles);
        } catch (error: any) {
            console.error("Error fetching files:", error);
            Alert.alert("Error", "Failed to fetch files");
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchFiles();
        }, [roomId])
    );

    const handleUpload = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                copyToCacheDirectory: true,
                multiple: false // simpler for now
            });

            if (result.canceled) return;
            const asset = result.assets[0];

            setUploading(true);

            const fileBase64 = await FileSystem.readAsStringAsync(asset.uri, {
                encoding: FileSystem.EncodingType.Base64,
            });
            const fileBytes = base64ToUint8Array(fileBase64);
            const fileName = (asset.name || `file-${Date.now()}`).replace(/[^a-zA-Z0-9.\-_]/g, "_");
            const basePath = await getStorageBasePath();
            const filePath = `${basePath}/${fileName}`;

            const { error } = await supabase.storage
                .from("user-files")
                .upload(filePath, fileBytes, {
                    contentType: asset.mimeType || "application/octet-stream",
                    upsert: true
                });

            if (error) throw error;

            await fetchFiles();
            Alert.alert("Success", "File uploaded successfully");

        } catch (error: any) {
            console.error("Upload error:", error);
            Alert.alert("Upload Failed", error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (fileName: string) => {
        try {
            const basePath = await getStorageBasePath();

            const { error } = await supabase.storage
                .from("user-files")
                .remove([`${basePath}/${fileName}`]);

            if (error) throw error;

            setFiles(prev => prev.filter(f => f.name !== fileName));
            setIsDeleteModalVisible(false);
            setSelectedFile(null);
        } catch (error: any) {
            Alert.alert("Error", error.message);
        }
    };

    const openRenameModal = (file: FileEntry) => {
        setRenameTarget(file);
        setRenameValue(file.name);
        setIsActionModalVisible(false);
        setIsRenameModalVisible(true);
    };

    const closeRenameModal = () => {
        setIsRenameModalVisible(false);
        setRenameTarget(null);
        setRenameValue("");
    };

    const handleRename = async () => {
        if (!renameTarget) return;

        const oldName = renameTarget.name;
        const newName = renameValue.trim();

        if (!newName || newName === oldName) {
            closeRenameModal();
            return;
        }

        if (files.some((file) => file.name === newName)) {
            Alert.alert("Error", "A file with this name already exists");
            return;
        }

        try {
            setRenaming(true);
            const basePath = await getStorageBasePath();
            const fromPath = `${basePath}/${oldName}`;
            const toPath = `${basePath}/${newName}`;

            const { error } = await supabase.storage
                .from("user-files")
                .move(fromPath, toPath);

            if (error) throw error;

            setFiles((prev) =>
                prev.map((file) =>
                    file.name === oldName ? { ...file, name: newName, id: newName } : file
                )
            );

            closeRenameModal();
        } catch (error: any) {
            console.error("Rename error:", error);
            Alert.alert("Error", error.message || "Failed to rename file");
        } finally {
            setRenaming(false);
        }
    };

    const showFileActions = (file: FileEntry) => {
        setSelectedFile(file);
        setIsActionModalVisible(true);
    };

    const openFile = async (file: FileEntry) => {
        try {
            const { publicUrl } = await getFilePublicUrl(file.name);

            if (!publicUrl) {
                throw new Error("Unable to get file URL");
            }

            const supported = await Linking.canOpenURL(publicUrl);
            if (!supported) {
                throw new Error("This file type cannot be opened on this device");
            }

            await Linking.openURL(publicUrl);
        } catch (error: any) {
            console.error("Open file error:", error);
            Alert.alert("Open Failed", error.message || "Unable to open this file");
        }
    };

    const getFilePublicUrl = async (fileName: string) => {
        const basePath = await getStorageBasePath();
        const { data: { publicUrl } } = supabase.storage
            .from("user-files")
            .getPublicUrl(`${basePath}/${fileName}`);

        return { publicUrl };
    };

    const copyFileLink = async (fileName: string) => {
        try {
            const { publicUrl } = await getFilePublicUrl(fileName);
            await Clipboard.setStringAsync(publicUrl);
            setIsActionModalVisible(false);
            Alert.alert("Copied", "File link copied to clipboard");
        } catch (error: any) {
            console.error("Copy file link error:", error);
            Alert.alert("Error", "Failed to copy file link");
        }
    };

    const shareFile = async (file: FileEntry) => {
        try {
            const { publicUrl } = await getFilePublicUrl(file.name);
            await Share.share({
                title: file.name,
                message: `${file.name}\n${publicUrl}`,
                url: publicUrl,
            });
            setIsActionModalVisible(false);
        } catch (error: any) {
            console.error("Share file error:", error);
            Alert.alert("Error", "Failed to share file");
        }
    };

    useEffect(() => {
        if (!registerAddAction) return;
        registerAddAction(() => {
            handleUpload();
        });
        return () => registerAddAction(null);
    }, [registerAddAction, roomId]);

    useFocusEffect(
        useCallback(() => {
            const shouldAutoUpload = params.autoUpload === "true" && !roomId;
            if (!shouldAutoUpload || autoUploadTriggeredRef.current) return;

            autoUploadTriggeredRef.current = true;
            setTimeout(() => {
                handleUpload().finally(() => {
                    router.replace("/files");
                });
            }, 0);
        }, [params.autoUpload, roomId, router])
    );

    const filteredFiles = files.filter((file) =>
        file.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
    );

    const renderItem = ({ item }: { item: FileEntry }) => (
        <Pressable
            onPress={() => openFile(item)}
            className="bg-slate-900/50 rounded-xl border border-slate-800 mb-3 overflow-hidden active:bg-slate-800/60"
        >
            <View className="flex-row items-center p-4">
                <View className="w-12 h-12 bg-slate-800 rounded-lg items-center justify-center mr-4">
                    {getFileIcon(item.name)}
                </View>
                <View className="flex-1">
                    <Text className="text-white font-medium text-base mb-0.5" numberOfLines={1}>{item.name}</Text>
                    <View className="flex-row items-center">
                        <Text className="text-slate-500 text-xs mr-2">{formatFileSize(item.size)}</Text>
                        <Text className="text-slate-600 text-[10px]">•</Text>
                        <Text className="text-slate-500 text-xs ml-2">
                            {new Date(item.updated_at).toLocaleDateString()}
                        </Text>
                    </View>
                </View>
                {roomId && (
                    <Pressable
                        onPress={() => setExpandedDiscussionFile((prev) => prev === item.name ? null : item.name)}
                        className="w-10 h-10 rounded-lg bg-slate-800 items-center justify-center mr-2"
                    >
                        <View className="relative">
                            <MessageCircle size={18} color="#94a3b8" />
                            {(itemCounts[item.name] || 0) > 0 && (
                                <View className="absolute -top-2 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 items-center justify-center">
                                    <Text className="text-white text-[10px] font-bold">
                                        {itemCounts[item.name] > 99 ? "99+" : itemCounts[item.name]}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </Pressable>
                )}
                <Pressable
                    onPress={(e) => {
                        e.stopPropagation();
                        showFileActions(item);
                    }}
                    className="p-2 bg-slate-800 rounded-lg active:bg-slate-700 ml-2"
                >
                    <EllipsisVertical size={18} color="#94a3b8" />
                </Pressable>
            </View>
            {roomId && expandedDiscussionFile === item.name && (
                <View className="px-4 pb-4">
                    <ItemDiscussion itemId={item.name} itemType="file" roomId={roomId} />
                </View>
            )}
        </Pressable>
    );

    const content = (
        <>
            {!embedded && (
                <ScreenHeader
                    title={roomId ? "Room Files" : "Files"}
                    onAdd={handleUpload}
                    addLabel="Upload"
                    loading={uploading}
                />
            )}

            <View className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 mb-4">
                <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search files..."
                    placeholderTextColor="#64748b"
                    className="text-white text-base"
                    autoCapitalize="none"
                    autoCorrect={false}
                />
            </View>

            {isLoading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#3b82f6" />
                </View>
            ) : files.length === 0 ? (
                <View className="flex-1 items-center justify-center pb-20">
                    <View className="w-20 h-20 bg-slate-800/50 rounded-full items-center justify-center mb-4">
                        <FileText size={40} color="#64748b" />
                    </View>
                    <Text className="text-slate-400 text-lg font-medium">No files yet</Text>
                    <Text className="text-slate-600 text-sm mt-2">Upload your first file</Text>
                </View>
            ) : filteredFiles.length === 0 ? (
                <View className="flex-1 items-center justify-center pb-20">
                    <View className="w-20 h-20 bg-slate-800/50 rounded-full items-center justify-center mb-4">
                        <FileText size={40} color="#64748b" />
                    </View>
                    <Text className="text-slate-400 text-lg font-medium">No matching files</Text>
                    <Text className="text-slate-600 text-sm mt-2">Try a different search term</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredFiles}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => {
                            setRefreshing(true);
                            fetchFiles();
                        }} tintColor="#fff" />
                    }
                    contentContainerStyle={{ paddingBottom: 20 }}
                />
            )}

            <Modal
                transparent
                visible={isActionModalVisible}
                animationType="fade"
                onRequestClose={() => setIsActionModalVisible(false)}
            >
                <View className="flex-1 bg-black/60 justify-center items-center p-4">
                    <View className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm">
                        <Text className="text-white text-xl font-bold mb-1" numberOfLines={1}>
                            {selectedFile?.name || "File"}
                        </Text>
                        <Text className="text-slate-500 text-sm mb-6">Choose an action</Text>

                        <Pressable
                            onPress={() => {
                                if (!selectedFile) return;
                                setIsActionModalVisible(false);
                                openFile(selectedFile);
                            }}
                            className="bg-slate-800 py-3.5 rounded-xl items-center mb-3"
                        >
                            <Text className="text-white font-semibold">Open</Text>
                        </Pressable>

                        <Pressable
                            onPress={() => selectedFile && copyFileLink(selectedFile.name)}
                            className="bg-slate-800 py-3.5 rounded-xl items-center mb-3"
                        >
                            <Text className="text-white font-semibold">Copy Link</Text>
                        </Pressable>

                        <Pressable
                            onPress={() => selectedFile && shareFile(selectedFile)}
                            className="bg-slate-800 py-3.5 rounded-xl items-center mb-3"
                        >
                            <Text className="text-white font-semibold">Share</Text>
                        </Pressable>

                        <Pressable
                            onPress={() => selectedFile && openRenameModal(selectedFile)}
                            className="bg-slate-800 py-3.5 rounded-xl items-center mb-3"
                        >
                            <Text className="text-white font-semibold">Rename</Text>
                        </Pressable>

                        <Pressable
                            onPress={() => {
                                setIsActionModalVisible(false);
                                setIsDeleteModalVisible(true);
                            }}
                            className="bg-red-600/20 border border-red-500/20 py-3.5 rounded-xl items-center mb-3"
                        >
                            <Text className="text-red-400 font-semibold">Delete</Text>
                        </Pressable>

                        <Pressable
                            onPress={() => setIsActionModalVisible(false)}
                            className="bg-slate-800 py-3 rounded-xl items-center"
                        >
                            <Text className="text-slate-300 font-medium">Cancel</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            <Modal
                transparent
                visible={isRenameModalVisible}
                animationType="fade"
                onRequestClose={closeRenameModal}
            >
                <View className="flex-1 bg-black/60 justify-center items-center p-4">
                    <View className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm">
                        <Text className="text-white text-xl font-bold mb-4">Rename File</Text>

                        <View className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 mb-6">
                            <TextInput
                                className="text-white text-base"
                                placeholder="New file name..."
                                placeholderTextColor="#64748b"
                                autoFocus
                                value={renameValue}
                                onChangeText={setRenameValue}
                                autoCapitalize="none"
                            />
                        </View>

                        <View className="flex-row gap-3">
                            <Pressable
                                onPress={closeRenameModal}
                                className="flex-1 bg-slate-800 py-3 rounded-xl items-center"
                            >
                                <Text className="text-slate-300 font-medium">Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleRename}
                                disabled={renaming || !renameValue.trim()}
                                className={`flex-1 bg-blue-600 py-3 rounded-xl items-center ${renaming || !renameValue.trim() ? "opacity-50" : ""}`}
                            >
                                {renaming ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <Text className="text-white font-bold">Rename</Text>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                transparent
                visible={isDeleteModalVisible}
                animationType="fade"
                onRequestClose={() => setIsDeleteModalVisible(false)}
            >
                <View className="flex-1 bg-black/60 justify-center items-center p-4">
                    <View className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm">
                        <Text className="text-white text-xl font-bold mb-2">Delete File</Text>
                        <Text className="text-slate-400 text-base mb-6">
                            {selectedFile ? `Are you sure you want to delete "${selectedFile.name}"?` : "Are you sure?"}
                        </Text>

                        <View className="flex-row gap-3">
                            <Pressable
                                onPress={() => setIsDeleteModalVisible(false)}
                                className="flex-1 bg-slate-800 py-3 rounded-xl items-center"
                            >
                                <Text className="text-slate-300 font-medium">Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={() => selectedFile && handleDelete(selectedFile.name)}
                                className="flex-1 bg-red-600 py-3 rounded-xl items-center"
                            >
                                <Text className="text-white font-bold">Delete</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );

    if (embedded) {
        return (
            <View className="flex-1 bg-slate-950">
                {content}
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-slate-950">
            {content}
        </SafeAreaView>
    );
}
