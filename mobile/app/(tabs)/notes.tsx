import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { View, Text, FlatList, Pressable, RefreshControl, Alert, ActivityIndicator, TextInput, Modal, ScrollView, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { useRouter, useFocusEffect } from "expo-router";
import {
    FileText,
    Search,
    X,
    Folder,
    FolderPlus,
    ChevronRight,
    ChevronDown,
    EllipsisVertical,
    Plus,
} from "lucide-react-native";
import ScreenHeader from "../../components/ScreenHeader";
import { useItemCounts } from "../../lib/useItemCounts";
import * as Clipboard from "expo-clipboard";
import ScreenCrashBoundary from "../../components/ScreenCrashBoundary";

type Note = {
    title: string;
    updated_at: string;
};

const isValidTitle = (value: unknown): value is string =>
    typeof value === "string" && value.trim().length > 0;

type TreeNode = {
    name: string;
    fullPath: string;
    type: "file" | "folder";
    updated_at?: string;
    children?: TreeNode[];
};

type ViewMode = "folders" | "files";
type ModalMode = "create-note" | "create-folder" | "rename";

const PLACEHOLDER_SUFFIX = "/.placeholder";

const isPlaceholderNote = (title: string) => title.endsWith(PLACEHOLDER_SUFFIX);
const getDisplayName = (path: string) => path.split("/").pop() || path;
const decodeHtmlEntities = (value: string) =>
    value
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

const htmlToPlainText = (value: string) => {
    if (!/<[a-z][\s\S]*>/i.test(value)) return value;

    return decodeHtmlEntities(
        value
            .replace(/<\/(p|div|h1|h2|h3|blockquote)>/gi, "\n\n")
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<li>/gi, "• ")
            .replace(/<\/li>/gi, "\n")
            .replace(/<[^>]+>/g, "")
    )
        .replace(/\n{3,}/g, "\n\n")
        .trim();
};

type NotesContentProps = {
    roomId?: string;
    embedded?: boolean;
    registerAddAction?: (action: (() => void) | null) => void;
};

export default function NotesScreen() {
    return (
        <ScreenCrashBoundary title="Notes couldn't open">
            <NotesContent />
        </ScreenCrashBoundary>
    );
}

export function NotesContent({ roomId, embedded = false, registerAddAction }: NotesContentProps) {
    const router = useRouter();
    const [notes, setNotes] = useState<Note[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState("");
    const [viewMode, setViewMode] = useState<ViewMode>("folders");
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

    const [isModalVisible, setIsModalVisible] = useState(false);
    const [modalMode, setModalMode] = useState<ModalMode>("create-note");
    const [modalValue, setModalValue] = useState("");
    const [modalTargetPath, setModalTargetPath] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [isActionModalVisible, setIsActionModalVisible] = useState(false);
    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
    const [selectedActionItem, setSelectedActionItem] = useState<{ path: string; type: "file" | "folder" } | null>(null);
    const itemCounts = useItemCounts(roomId, "note");

    const fetchNotes = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            let query = supabase
                .from("notes")
                .select("title, updated_at")
                .order("updated_at", { ascending: false });

            query = roomId
                ? query.eq("room_id", roomId)
                : query.eq("user_id", user.id).is("room_id", null);

            const { data, error } = await query;

            if (error) throw error;
            const sanitizedNotes = (data || [])
                .filter((note: any) => isValidTitle(note?.title))
                .map((note: any) => ({
                    title: note.title,
                    updated_at: typeof note.updated_at === "string" ? note.updated_at : "",
                }));
            setNotes(sanitizedNotes);
        } catch (error: any) {
            console.error("Error fetching notes:", error);
            Alert.alert("Error", "Failed to fetch notes");
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchNotes();
        }, [roomId])
    );

    const notePaths = useMemo(
        () => notes.map((note) => note.title),
        [notes]
    );

    const treeStructure = useMemo(() => {
        const root: TreeNode[] = [];
        const folderMap = new Map<string, TreeNode>();
        const noteMap = new Map(notes.map((note) => [note.title, note]));

        const filteredItems = notePaths.filter((item) => {
            const searchableLabel = item.replace(PLACEHOLDER_SUFFIX, "");
            if (!searchableLabel.toLowerCase().includes(search.toLowerCase())) return false;

            const isRootFile = !item.includes("/");
            if (viewMode === "files") {
                return isRootFile && !isPlaceholderNote(item);
            }

            return !isRootFile;
        });

        const sortedItems = [...filteredItems].sort((a, b) => {
            const aParts = a.split("/");
            const bParts = b.split("/");
            for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
                if (aParts[i] !== bParts[i]) {
                    return aParts[i].localeCompare(bParts[i]);
                }
            }
            return aParts.length - bParts.length;
        });

        sortedItems.forEach((item) => {
            const parts = item.split("/");

            if (parts.length === 1) {
                const note = noteMap.get(item);
                root.push({
                    name: parts[0],
                    fullPath: item,
                    type: "file",
                    updated_at: note?.updated_at,
                });
                return;
            }

            let currentPath = "";
            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                const parentPath = currentPath;
                currentPath = currentPath ? `${currentPath}/${part}` : part;

                if (!folderMap.has(currentPath)) {
                    const folderNode: TreeNode = {
                        name: part,
                        fullPath: currentPath,
                        type: "folder",
                        children: [],
                    };
                    folderMap.set(currentPath, folderNode);

                    if (parentPath) {
                        folderMap.get(parentPath)?.children?.push(folderNode);
                    } else {
                        root.push(folderNode);
                    }
                }
            }

            if (!isPlaceholderNote(item)) {
                const parentPath = parts.slice(0, -1).join("/");
                const note = noteMap.get(item);
                const fileNode: TreeNode = {
                    name: parts[parts.length - 1],
                    fullPath: item,
                    type: "file",
                    updated_at: note?.updated_at,
                };

                if (parentPath) {
                    folderMap.get(parentPath)?.children?.push(fileNode);
                } else {
                    root.push(fileNode);
                }
            }
        });

        const sortNodes = (nodes: TreeNode[]) => {
            nodes.sort((a, b) => {
                if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
                return a.name.localeCompare(b.name);
            });
            nodes.forEach((node) => {
                if (node.children) sortNodes(node.children);
            });
        };

        sortNodes(root);
        return root;
    }, [notePaths, notes, search, viewMode]);

    const strayFiles = useMemo(
        () =>
            notes.filter(
                (note) =>
                    !note.title.includes("/") &&
                    !isPlaceholderNote(note.title) &&
                    note.title.toLowerCase().includes(search.toLowerCase())
            ),
        [notes, search]
    );

    const toggleFolder = (folderPath: string) => {
        setExpandedFolders((prev) => {
            const next = new Set(prev);
            if (next.has(folderPath)) next.delete(folderPath);
            else next.add(folderPath);
            return next;
        });
    };

    const closeModal = () => {
        setIsModalVisible(false);
        setModalValue("");
        setModalTargetPath(null);
    };

    const openCreateNoteModal = (folderPath?: string) => {
        setModalMode("create-note");
        setModalTargetPath(folderPath || null);
        setModalValue(folderPath ? `${folderPath}/` : "");
        setIsModalVisible(true);
    };

    const openCreateFolderModal = () => {
        setModalMode("create-folder");
        setModalTargetPath(null);
        setModalValue("");
        setIsModalVisible(true);
    };

    const openRenameModal = (path: string) => {
        setModalMode("rename");
        setModalTargetPath(path);
        setModalValue(getDisplayName(path));
        setIsActionModalVisible(false);
        setIsModalVisible(true);
    };

    const handleCreateFolder = async () => {
        const folderName = modalValue.trim();
        if (!folderName) return;
        if (folderName.includes("/")) {
            Alert.alert("Invalid name", "Folder name cannot contain '/'.");
            return;
        }

        const fullPath = folderName;
        const folderExists = notePaths.some(
            (path) => path === fullPath || path.startsWith(`${fullPath}/`)
        );

        if (folderExists) {
            Alert.alert("Already exists", `Folder "${folderName}" already exists.`);
            return;
        }

        try {
            setCreating(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { encrypt } = await import("../../lib/crypto-safe");
            const encrypted = await encrypt("", user.id);
            const placeholderPath = `${fullPath}/.placeholder`;

            const { error } = await supabase.from("notes").insert({
                user_id: roomId ? null : user.id,
                room_id: roomId ?? null,
                title: placeholderPath,
                ciphertext: encrypted.ciphertext,
                iv: encrypted.iv,
                salt: encrypted.salt,
            });

            if (error) throw error;

            setExpandedFolders((prev) => new Set(prev).add(fullPath));
            closeModal();
            fetchNotes();
        } catch (error: any) {
            console.error("Create folder error:", error);
            Alert.alert("Error", "Failed to create folder");
        } finally {
            setCreating(false);
        }
    };

    const handleCreateNote = async () => {
        const title = modalValue.trim();
        if (!title) return;

        if (notePaths.some((path) => path === title)) {
            Alert.alert("Already exists", "Note with this name already exists.");
            return;
        }

        setCreating(true);
        try {
            closeModal();
            router.push({
                pathname: "/note_editor",
                params: { title, isNew: "true", ...(roomId ? { roomId } : {}) }
            });
        } catch (error: any) {
            Alert.alert("Error", error.message);
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteNote = async (title: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        let query = supabase
            .from("notes")
            .delete()
            .eq("title", title);

        query = roomId
            ? query.eq("room_id", roomId)
            : query.eq("user_id", user.id).is("room_id", null);

        const { error } = await query;

        if (error) throw error;
    };

    const handleDeletePath = async (path: string) => {
        const isFolder = notePaths.some(
            (notePath) => notePath !== path && notePath.startsWith(`${path}/`)
        );
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            if (isFolder) {
                const pathsToDelete = notePaths.filter((notePath) => notePath.startsWith(`${path}/`));
                for (const notePath of pathsToDelete) {
                    let query = supabase
                        .from("notes")
                        .delete()
                        .eq("title", notePath);
                    query = roomId
                        ? query.eq("room_id", roomId)
                        : query.eq("user_id", user.id).is("room_id", null);
                    const { error } = await query;
                    if (error) throw error;
                }
            } else {
                await handleDeleteNote(path);
            }

            setIsDeleteModalVisible(false);
            setSelectedActionItem(null);
            fetchNotes();
        } catch (error: any) {
            console.error("Delete error:", error);
            Alert.alert("Error", "Failed to delete item");
        }
    };

    const handleRename = async () => {
        const targetPath = modalTargetPath;
        const newName = modalValue.trim();

        if (!targetPath || !newName) return;

        const oldName = getDisplayName(targetPath);
        if (newName === oldName) {
            closeModal();
            return;
        }

        if (newName.includes("/")) {
            Alert.alert("Invalid name", "Name cannot contain '/'.");
            return;
        }

        const isFolder = notePaths.some(
            (path) => path !== targetPath && path.startsWith(`${targetPath}/`)
        );

        const pathParts = targetPath.split("/");
        pathParts[pathParts.length - 1] = newName;
        const newPath = pathParts.join("/");

        if (notePaths.some((path) => path === newPath || path.startsWith(`${newPath}/`))) {
            Alert.alert("Already exists", `A ${isFolder ? "folder" : "note"} with that name already exists.`);
            return;
        }

        try {
            setCreating(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            if (isFolder) {
                const itemsToRename = notePaths.filter((path) => path.startsWith(`${targetPath}/`));
                for (const oldPath of itemsToRename) {
                    const nextPath = oldPath.replace(targetPath, newPath);
                    let query = supabase
                        .from("notes")
                        .update({ title: nextPath })
                        .eq("title", oldPath);
                    query = roomId
                        ? query.eq("room_id", roomId)
                        : query.eq("user_id", user.id).is("room_id", null);
                    const { error } = await query;

                    if (error) throw error;
                }

                setExpandedFolders((prev) => {
                    const next = new Set(prev);
                    next.delete(targetPath);
                    next.add(newPath);
                    return next;
                });
            } else {
                let query = supabase
                    .from("notes")
                    .update({ title: newPath })
                    .eq("title", targetPath);
                query = roomId
                    ? query.eq("room_id", roomId)
                    : query.eq("user_id", user.id).is("room_id", null);
                const { error } = await query;

                if (error) throw error;
            }

            closeModal();
            fetchNotes();
        } catch (error: any) {
            console.error("Rename error:", error);
            Alert.alert("Error", "Failed to rename item");
        } finally {
            setCreating(false);
        }
    };

    const showItemActions = (path: string, type: "file" | "folder") => {
        setSelectedActionItem({ path, type });
        setIsActionModalVisible(true);
    };

    const getNotePlainText = async (title: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not found");

        let query = supabase
            .from("notes")
            .select("ciphertext, iv, salt")
            .eq("title", title);

        query = roomId
            ? query.eq("room_id", roomId)
            : query.eq("user_id", user.id).is("room_id", null);

        const { data, error } = await query.single();
        if (error) throw error;

        const { decrypt } = await import("../../lib/crypto-safe");
        const decrypted = await decrypt({
            ciphertext: data.ciphertext,
            iv: data.iv,
            salt: data.salt,
        }, roomId ?? user.id);

            return htmlToPlainText(decrypted);
    };

    const copyNote = async (title: string) => {
        try {
            const text = await getNotePlainText(title);
            await Clipboard.setStringAsync(text);
            setIsActionModalVisible(false);
            Alert.alert("Copied", "Note content copied to clipboard");
        } catch (error: any) {
            console.error("Copy note error:", error);
            Alert.alert("Error", "Failed to copy note");
        }
    };

    const shareNote = async (title: string) => {
        try {
            const text = await getNotePlainText(title);
            await Share.share({
                title: getDisplayName(title),
                message: `${getDisplayName(title)}\n\n${text}`,
            });
            setIsActionModalVisible(false);
        } catch (error: any) {
            console.error("Share note error:", error);
            Alert.alert("Error", "Failed to share note");
        }
    };

    const renderTreeNode = (node: TreeNode, depth = 0): ReactNode => {
        const paddingLeft = 16 + depth * 18;

        if (node.type === "folder") {
            const isExpanded = expandedFolders.has(node.fullPath);
            return (
                <View key={node.fullPath}>
                    <View className="flex-row items-center bg-slate-900/50 rounded-xl border border-slate-800 mb-3">
                        <Pressable
                            onPress={() => toggleFolder(node.fullPath)}
                            className="flex-1 flex-row items-center px-4 py-4"
                            style={{ paddingLeft }}
                        >
                            {isExpanded ? (
                                <ChevronDown size={18} color="#94a3b8" />
                            ) : (
                                <ChevronRight size={18} color="#94a3b8" />
                            )}
                            <View className="w-9 h-9 bg-amber-500/10 rounded-lg items-center justify-center ml-3 mr-3 border border-amber-500/20">
                                <Folder size={18} color="#fbbf24" />
                            </View>
                            <Text className="flex-1 text-white font-medium text-base" numberOfLines={1}>
                                {node.name}
                            </Text>
                        </Pressable>

                        <Pressable
                            onPress={() => showItemActions(node.fullPath, "folder")}
                            className="px-4 py-4"
                        >
                            <EllipsisVertical size={18} color="#94a3b8" />
                        </Pressable>
                    </View>

                    {isExpanded && node.children?.map((child) => renderTreeNode(child, depth + 1))}
                </View>
            );
        }

        return (
            <Pressable
                key={node.fullPath}
                onPress={() => router.push({ pathname: "/note_editor", params: { title: node.fullPath, ...(roomId ? { roomId } : {}) } })}
                className="flex-row items-center bg-slate-900/50 p-4 rounded-xl border border-slate-800 mb-3 active:bg-slate-800/80"
                style={{ paddingLeft }}
            >
                <View className="w-9 h-9 bg-blue-500/10 rounded-lg items-center justify-center mr-4 border border-blue-500/20">
                    <FileText size={18} color="#60a5fa" />
                </View>
                <View className="flex-1">
                    <Text className="text-white font-medium text-base mb-0.5" numberOfLines={1}>
                        {node.name}
                    </Text>
                    <Text className="text-slate-500 text-xs">
                        {node.updated_at ? new Date(node.updated_at).toLocaleDateString() : ""}
                    </Text>
                </View>
                {roomId && (
                    <View className="mr-2 min-w-[24px] h-6 px-2 rounded-full bg-slate-800 items-center justify-center">
                        <Text className="text-slate-300 text-[11px] font-medium">
                            {itemCounts[node.fullPath] || 0}
                        </Text>
                    </View>
                )}
                <Pressable
                    onPress={(e) => {
                        e.stopPropagation();
                        showItemActions(node.fullPath, "file");
                    }}
                    className="p-2"
                >
                    <EllipsisVertical size={18} color="#94a3b8" />
                </Pressable>
            </Pressable>
        );
    };

    const renderStrayFile = ({ item }: { item: Note }) => (
        <Pressable
            onPress={() => router.push({ pathname: "/note_editor", params: { title: item.title, ...(roomId ? { roomId } : {}) } })}
            className="flex-row items-center bg-slate-900/50 p-4 rounded-xl border border-slate-800 mb-3 active:bg-slate-800/80"
        >
            <View className="w-10 h-10 bg-blue-500/10 rounded-lg items-center justify-center mr-4 border border-blue-500/20">
                <FileText size={20} color="#60a5fa" />
            </View>
            <View className="flex-1">
                <Text className="text-white font-medium text-base mb-0.5" numberOfLines={1}>{item.title}</Text>
                <Text className="text-slate-500 text-xs">
                    {new Date(item.updated_at).toLocaleDateString()}
                </Text>
            </View>
            {roomId && (
                <View className="mr-2 min-w-[24px] h-6 px-2 rounded-full bg-slate-800 items-center justify-center">
                    <Text className="text-slate-300 text-[11px] font-medium">
                        {itemCounts[item.title] || 0}
                    </Text>
                </View>
            )}
            <Pressable
                onPress={(e) => {
                    e.stopPropagation();
                    showItemActions(item.title, "file");
                }}
                className="p-2"
            >
                <EllipsisVertical size={18} color="#94a3b8" />
            </Pressable>
        </Pressable>
    );

    const renderModalTitle =
        modalMode === "create-folder"
            ? "New Folder"
            : modalMode === "rename"
                ? "Rename"
                : "New Note";

    const renderModalPlaceholder =
        modalMode === "create-folder"
            ? "Folder name..."
            : modalMode === "rename"
                ? "New name..."
                : "folder/note-name";

    const submitModal = () => {
        if (modalMode === "create-folder") {
            handleCreateFolder();
            return;
        }

        if (modalMode === "rename") {
            handleRename();
            return;
        }

        handleCreateNote();
    };

    useEffect(() => {
        if (!registerAddAction) return;
        registerAddAction(() => openCreateNoteModal());
        return () => registerAddAction(null);
    }, [registerAddAction]);

    const hasVisibleFolderItems = treeStructure.length > 0;
    const hasVisibleStrayFiles = strayFiles.length > 0;
    const isEmptyState = viewMode === "folders" ? !hasVisibleFolderItems : !hasVisibleStrayFiles;

    const content = (
        <>
            {!embedded && (
                <ScreenHeader
                    title={roomId ? "Room Notes" : "Notes"}
                    onAdd={() => openCreateNoteModal()}
                    addLabel="New Note"
                />
            )}

            <View className="flex-row bg-slate-900 border border-slate-800 rounded-xl p-1 mb-4">
                <Pressable
                    onPress={() => setViewMode("folders")}
                    className={`flex-1 flex-row items-center justify-center py-3 rounded-lg ${viewMode === "folders" ? "bg-slate-800" : ""}`}
                >
                    <Folder size={16} color={viewMode === "folders" ? "#ffffff" : "#94a3b8"} />
                    <Text className={`ml-2 font-medium ${viewMode === "folders" ? "text-white" : "text-slate-400"}`}>
                        Folders
                    </Text>
                </Pressable>
                <Pressable
                    onPress={() => setViewMode("files")}
                    className={`flex-1 flex-row items-center justify-center py-3 rounded-lg ${viewMode === "files" ? "bg-slate-800" : ""}`}
                >
                    <FileText size={16} color={viewMode === "files" ? "#ffffff" : "#94a3b8"} />
                    <Text className={`ml-2 font-medium ${viewMode === "files" ? "text-white" : "text-slate-400"}`}>
                        Stray Files
                    </Text>
                </Pressable>
            </View>

            <View className="flex-row items-center bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 mb-4">
                <Search size={20} color="#64748b" />
                <TextInput
                    className="flex-1 ml-3 text-white text-base"
                    placeholder="Search notes..."
                    placeholderTextColor="#64748b"
                    value={search}
                    onChangeText={setSearch}
                />
                {search.length > 0 && (
                    <Pressable onPress={() => setSearch("")}>
                        <X size={18} color="#94a3b8" />
                    </Pressable>
                )}
            </View>

            <View className="flex-row gap-3 mb-6">
                {viewMode === "folders" && (
                    <Pressable
                        onPress={openCreateFolderModal}
                        className="flex-1 bg-slate-800 py-3.5 rounded-xl items-center justify-center flex-row border border-slate-700"
                    >
                        <FolderPlus size={18} color="#e2e8f0" />
                        <Text className="text-slate-200 font-medium ml-2">Folder</Text>
                    </Pressable>
                )}
                <Pressable
                    onPress={() => openCreateNoteModal()}
                    className="flex-1 bg-blue-600 py-3.5 rounded-xl items-center justify-center flex-row"
                >
                    <Plus size={18} color="#ffffff" />
                    <Text className="text-white font-bold ml-2">Note</Text>
                </Pressable>
            </View>

            {isLoading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#3b82f6" />
                </View>
            ) : isEmptyState ? (
                <View className="flex-1 items-center justify-center pb-20">
                    <View className="w-20 h-20 bg-slate-800/50 rounded-full items-center justify-center mb-4">
                        {viewMode === "folders" ? (
                            <Folder size={40} color="#64748b" />
                        ) : (
                            <FileText size={40} color="#64748b" />
                        )}
                    </View>
                    <Text className="text-slate-400 text-lg font-medium">
                        {search ? "No matches found" : viewMode === "folders" ? "No folders yet" : "No stray files yet"}
                    </Text>
                    {!search && (
                        <Text className="text-slate-600 text-sm mt-2">
                            {viewMode === "folders" ? "Create a folder or add notes inside one" : "Create a note at the root level"}
                        </Text>
                    )}
                </View>
            ) : viewMode === "files" ? (
                <FlatList
                    data={strayFiles}
                    renderItem={renderStrayFile}
                    keyExtractor={(item) => item.title}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                setRefreshing(true);
                                fetchNotes();
                            }}
                            tintColor="#fff"
                        />
                    }
                    contentContainerStyle={{ paddingBottom: 20 }}
                />
            ) : (
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                setRefreshing(true);
                                fetchNotes();
                            }}
                            tintColor="#fff"
                        />
                    }
                    contentContainerStyle={{ paddingBottom: 20 }}
                >
                    {treeStructure.map((node) => renderTreeNode(node))}
                </ScrollView>
            )}

            <Modal
                transparent
                visible={isActionModalVisible}
                animationType="fade"
                onRequestClose={() => setIsActionModalVisible(false)}
            >
                <Pressable onPress={() => setIsActionModalVisible(false)} className="flex-1 bg-black/60 justify-center items-center p-4">
                    <Pressable onPress={(e) => e.stopPropagation()} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm">
                        <Text className="text-white text-xl font-bold mb-1" numberOfLines={1}>
                            {selectedActionItem ? getDisplayName(selectedActionItem.path) : "Item"}
                        </Text>
                        <Text className="text-slate-500 text-sm mb-6">Choose an action</Text>

                        {selectedActionItem?.type === "folder" && (
                            <Pressable
                                onPress={() => selectedActionItem && openCreateNoteModal(selectedActionItem.path)}
                                className="bg-slate-800 py-3.5 rounded-xl items-center mb-3"
                            >
                                <Text className="text-white font-semibold">New Note</Text>
                            </Pressable>
                        )}

                        {selectedActionItem?.type === "file" && (
                            <Pressable
                                onPress={() => selectedActionItem && copyNote(selectedActionItem.path)}
                                className="bg-slate-800 py-3.5 rounded-xl items-center mb-3"
                            >
                                <Text className="text-white font-semibold">Copy</Text>
                            </Pressable>
                        )}

                        {selectedActionItem?.type === "file" && (
                            <Pressable
                                onPress={() => selectedActionItem && shareNote(selectedActionItem.path)}
                                className="bg-slate-800 py-3.5 rounded-xl items-center mb-3"
                            >
                                <Text className="text-white font-semibold">Share</Text>
                            </Pressable>
                        )}

                        <Pressable
                            onPress={() => selectedActionItem && openRenameModal(selectedActionItem.path)}
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
                    </Pressable>
                </Pressable>
            </Modal>

            <Modal
                transparent
                visible={isModalVisible}
                animationType="fade"
                onRequestClose={closeModal}
            >
                <Pressable onPress={closeModal} className="flex-1 bg-black/60 justify-center items-center p-4">
                    <Pressable onPress={(e) => e.stopPropagation()} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm">
                        <Text className="text-white text-xl font-bold mb-4">{renderModalTitle}</Text>

                        <View className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 mb-6">
                            <TextInput
                                className="text-white text-base"
                                placeholder={renderModalPlaceholder}
                                placeholderTextColor="#64748b"
                                autoFocus
                                value={modalValue}
                                onChangeText={setModalValue}
                                autoCapitalize="none"
                            />
                        </View>

                        <View className="flex-row gap-3">
                            <Pressable
                                onPress={closeModal}
                                className="flex-1 bg-slate-800 py-3 rounded-xl items-center"
                            >
                                <Text className="text-slate-300 font-medium">Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={submitModal}
                                disabled={creating || !modalValue.trim()}
                                className={`flex-1 bg-blue-600 py-3 rounded-xl items-center ${creating || !modalValue.trim() ? "opacity-50" : ""}`}
                            >
                                {creating ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <Text className="text-white font-bold">
                                        {modalMode === "rename" ? "Rename" : "Create"}
                                    </Text>
                                )}
                            </Pressable>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            <Modal
                transparent
                visible={isDeleteModalVisible}
                animationType="fade"
                onRequestClose={() => setIsDeleteModalVisible(false)}
            >
                <Pressable onPress={() => setIsDeleteModalVisible(false)} className="flex-1 bg-black/60 justify-center items-center p-4">
                    <Pressable onPress={(e) => e.stopPropagation()} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm">
                        <Text className="text-white text-xl font-bold mb-2">
                            Delete {selectedActionItem?.type === "folder" ? "Folder" : "Note"}
                        </Text>
                        <Text className="text-slate-400 text-base mb-6">
                            {selectedActionItem
                                ? `Are you sure you want to delete "${getDisplayName(selectedActionItem.path)}"?${selectedActionItem.type === "folder" ? " This will delete all notes inside." : ""}`
                                : "Are you sure?"}
                        </Text>

                        <View className="flex-row gap-3">
                            <Pressable
                                onPress={() => setIsDeleteModalVisible(false)}
                                className="flex-1 bg-slate-800 py-3 rounded-xl items-center"
                            >
                                <Text className="text-slate-300 font-medium">Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={() => selectedActionItem && handleDeletePath(selectedActionItem.path)}
                                className="flex-1 bg-red-600 py-3 rounded-xl items-center"
                            >
                                <Text className="text-white font-bold">Delete</Text>
                            </Pressable>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );

    if (embedded) {
        return (
            <View className="flex-1 bg-slate-950">
                <ScreenCrashBoundary title="Notes couldn't open">
                    {content}
                </ScreenCrashBoundary>
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-slate-950">
            <ScreenCrashBoundary title="Notes couldn't open">
                {content}
            </ScreenCrashBoundary>
        </SafeAreaView>
    );
}
