import { useState, useCallback, useEffect, useRef } from "react";
import { View, Text, FlatList, Pressable, RefreshControl, Alert, ActivityIndicator, Image as RNImage, Modal, TextInput, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { Image as ImageIcon, Trash2, X, MessageCircle } from "lucide-react-native";
import ScreenHeader from "../../components/ScreenHeader";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useItemCounts } from "../../lib/useItemCounts";
import ItemDiscussion from "../../components/ItemDiscussion";
import * as Clipboard from "expo-clipboard";
import { base64ToUint8Array } from "../../lib/base64";

type ImageEntry = {
    name: string;
    id: string; // just to have a key
    size?: number;
    updated_at: string;
    mimetype?: string;
    url?: string;
};

const BUCKET = "user-images";

type ImagesContentProps = {
    roomId?: string;
    embedded?: boolean;
    registerAddAction?: (action: (() => void) | null) => void;
};

export default function ImagesScreen() {
    return <ImagesContent />;
}

export function ImagesContent({ roomId, embedded = false, registerAddAction }: ImagesContentProps) {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [images, setImages] = useState<ImageEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedImage, setSelectedImage] = useState<ImageEntry | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [isDiscussionOpen, setIsDiscussionOpen] = useState(false);
    const autoUploadTriggeredRef = useRef(false);
    const itemCounts = useItemCounts(roomId, "image");

    const fetchImages = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const folderPath = roomId ? `room-${roomId}` : user.id;
            const { data, error } = await supabase.storage
                .from(BUCKET)
                .list(folderPath, {
                    limit: 100,
                    offset: 0,
                    sortBy: { column: 'updated_at', order: 'desc' },
                });

            if (error) throw error;

            const formattedImages: ImageEntry[] = await Promise.all(
                data.map(async (file) => {
                    // Get public URL for preview
                    const { data: { publicUrl } } = supabase.storage
                        .from(BUCKET)
                        .getPublicUrl(`${folderPath}/${file.name}`);

                    return {
                        name: file.name,
                        id: file.id || file.name,
                        size: file.metadata?.size,
                        updated_at: file.updated_at || new Date().toISOString(),
                        mimetype: file.metadata?.mimetype,
                        url: publicUrl
                    };
                })
            );

            setImages(formattedImages);
        } catch (error: any) {
            console.error("Error fetching images:", error);
            // Alert.alert("Error", "Failed to fetch images");
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchImages();
        }, [roomId])
    );

    const handleUpload = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: "image/*",
                copyToCacheDirectory: true,
                multiple: false
            });

            if (result.canceled) return;
            const asset = result.assets[0];

            setUploading(true);

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not found");

            const fileBase64 = await FileSystem.readAsStringAsync(asset.uri, {
                encoding: FileSystem.EncodingType.Base64,
            });
            const fileBytes = base64ToUint8Array(fileBase64);
            // Sanitize filename
            const fileName = (asset.name || `image-${Date.now()}`).replace(/[^a-zA-Z0-9.\-_]/g, "_");
            const filePath = `${roomId ? `room-${roomId}` : user.id}/${fileName}`;

            const { error } = await supabase.storage
                .from(BUCKET)
                .upload(filePath, fileBytes, {
                    contentType: asset.mimeType || "image/jpeg",
                    upsert: true
                });

            if (error) throw error;

            await fetchImages();
            Alert.alert("Success", "Image uploaded successfully");

        } catch (error: any) {
            console.error("Upload error:", error);
            Alert.alert("Upload Failed", error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (image: ImageEntry) => {
        Alert.alert(
            "Delete Image",
            `Are you sure you want to delete "${image.name}"?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const { data: { user } } = await supabase.auth.getUser();
                            if (!user) return;

                            const { error } = await supabase.storage
                                .from(BUCKET)
                                .remove([`${roomId ? `room-${roomId}` : user.id}/${image.name}`]);

                            if (error) throw error;

                            setImages(prev => prev.filter(f => f.id !== image.id));
                            if (selectedImage?.id === image.id) setSelectedImage(null);
                        } catch (error: any) {
                            Alert.alert("Error", error.message);
                        }
                    }
                }
            ]
        );
    };

    const renderItem = ({ item }: { item: ImageEntry }) => (
        <Pressable
            onPress={() => {
                setSelectedImage(item);
                setIsDiscussionOpen(false);
            }}
            className="flex-1 m-1 aspect-square bg-slate-800 rounded-xl overflow-hidden border border-slate-700 relative"
        >
            <RNImage
                source={{ uri: item.url }}
                className="w-full h-full"
                resizeMode="cover"
            />
            {roomId && (itemCounts[item.name] || 0) > 0 && (
                <View className="absolute top-2 right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 items-center justify-center">
                    <Text className="text-white text-[10px] font-bold">
                        {itemCounts[item.name] > 99 ? "99+" : itemCounts[item.name]}
                    </Text>
                </View>
            )}
            <View className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 flex-row justify-between items-center">
                <Text className="text-white text-[10px] truncate flex-1 mr-1" numberOfLines={1}>
                    {item.name}
                </Text>
            </View>
        </Pressable>
    );

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
                    router.replace("/images");
                });
            }, 0);
        }, [params.autoUpload, roomId, router])
    );

    const getImagePublicUrl = async (imageName: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not found");

        const folderPath = roomId ? `room-${roomId}` : user.id;
        const { data: { publicUrl } } = supabase.storage
            .from(BUCKET)
            .getPublicUrl(`${folderPath}/${imageName}`);

        return { publicUrl };
    };

    const copyImageLink = async (imageName: string) => {
        try {
            const { publicUrl } = await getImagePublicUrl(imageName);
            await Clipboard.setStringAsync(publicUrl);
            Alert.alert("Copied", "Image link copied to clipboard");
        } catch (error: any) {
            console.error("Copy image link error:", error);
            Alert.alert("Error", "Failed to copy image link");
        }
    };

    const shareImage = async (image: ImageEntry) => {
        try {
            const imageUrl = image.url || (await getImagePublicUrl(image.name)).publicUrl;
            await Share.share({
                title: image.name,
                message: `${image.name}\n${imageUrl}`,
                url: imageUrl,
            });
        } catch (error: any) {
            console.error("Share image error:", error);
            Alert.alert("Error", "Failed to share image");
        }
    };

    const filteredImages = images.filter((image) =>
        image.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
    );

    const content = (
        <>
            {!embedded && (
                <ScreenHeader
                    title={roomId ? "Room Images" : "Images"}
                    onAdd={handleUpload}
                    addLabel="Upload"
                    loading={uploading}
                />
            )}

            <View className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 mb-4">
                <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search images..."
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
            ) : images.length === 0 ? (
                <View className="flex-1 items-center justify-center pb-20">
                    <View className="w-20 h-20 bg-slate-800/50 rounded-full items-center justify-center mb-4">
                        <ImageIcon size={40} color="#64748b" />
                    </View>
                    <Text className="text-slate-400 text-lg font-medium">No images yet</Text>
                    <Text className="text-slate-600 text-sm mt-2">Upload your first image</Text>
                </View>
            ) : filteredImages.length === 0 ? (
                <View className="flex-1 items-center justify-center pb-20">
                    <View className="w-20 h-20 bg-slate-800/50 rounded-full items-center justify-center mb-4">
                        <ImageIcon size={40} color="#64748b" />
                    </View>
                    <Text className="text-slate-400 text-lg font-medium">No matching images</Text>
                    <Text className="text-slate-600 text-sm mt-2">Try a different search term</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredImages}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    numColumns={3}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => {
                            setRefreshing(true);
                            fetchImages();
                        }} tintColor="#fff" />
                    }
                    contentContainerStyle={{ paddingBottom: 20 }}
                />
            )}

            {/* Image Detail Modal */}
            <Modal
                visible={!!selectedImage}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setSelectedImage(null)}
            >
                <View className="flex-1 bg-black/90 justify-center items-center p-4">
                    <SafeAreaView className="w-full h-full">
                        <View className="flex-row justify-end p-2 z-10">
                            <Pressable
                                onPress={() => setSelectedImage(null)}
                                className="p-2 bg-slate-800/50 rounded-full"
                            >
                                <X size={24} color="white" />
                            </Pressable>
                        </View>

                        {selectedImage && (
                            <View className="flex-1 justify-center items-center pb-8">
                                <RNImage
                                    source={{ uri: selectedImage.url }}
                                    className="w-full flex-1"
                                    resizeMode="contain"
                                />
                                <Text className="text-white text-lg font-medium mt-4 text-center">
                                    {selectedImage.name}
                                </Text>
                                <Text className="text-slate-400 text-sm">
                                    {new Date(selectedImage.updated_at).toLocaleString()}
                                </Text>

                                {roomId && (
                                    <Pressable
                                        onPress={() => setIsDiscussionOpen((prev) => !prev)}
                                        className="mt-4 bg-slate-800 px-6 py-3 rounded-xl items-center justify-center flex-row"
                                    >
                                        <View className="relative">
                                            <MessageCircle size={18} color="#e2e8f0" />
                                            {(itemCounts[selectedImage.name] || 0) > 0 && (
                                                <View className="absolute -top-2 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 items-center justify-center">
                                                    <Text className="text-white text-[10px] font-bold">
                                                        {itemCounts[selectedImage.name] > 99 ? "99+" : itemCounts[selectedImage.name]}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text className="text-white font-semibold ml-2">
                                            {isDiscussionOpen ? "Hide Discussion" : "Show Discussion"}
                                        </Text>
                                    </Pressable>
                                )}

                                <View className="mt-6 w-full gap-3">
                                    <Pressable
                                        onPress={() => copyImageLink(selectedImage.name)}
                                        className="bg-slate-800 px-6 py-3 rounded-xl items-center"
                                    >
                                        <Text className="text-white font-semibold">Copy Link</Text>
                                    </Pressable>

                                    <Pressable
                                        onPress={() => shareImage(selectedImage)}
                                        className="bg-slate-800 px-6 py-3 rounded-xl items-center"
                                    >
                                        <Text className="text-white font-semibold">Share</Text>
                                    </Pressable>

                                </View>

                                <Pressable
                                    onPress={() => {
                                        handleDelete(selectedImage);
                                    }}
                                    className="mt-3 mb-2 bg-red-600/20 border border-red-600/50 px-6 py-3 rounded-xl flex-row items-center"
                                >
                                    <Trash2 size={20} color="#ef4444" className="mr-2" />
                                    <Text className="text-red-400 font-semibold">Delete Image</Text>
                                </Pressable>

                                {roomId && isDiscussionOpen && (
                                    <View className="mt-4 w-full">
                                        <ItemDiscussion itemId={selectedImage.name} itemType="image" roomId={roomId} />
                                    </View>
                                )}
                            </View>
                        )}
                    </SafeAreaView>
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
