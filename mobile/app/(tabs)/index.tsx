import { View, Text, ScrollView, Pressable, Modal, TouchableWithoutFeedback, TextInput, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { FileText, Folder, Image as ImageIcon, Plus, DoorOpen, Users, EllipsisVertical } from "lucide-react-native";
import { useState, useCallback, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter, useFocusEffect } from "expo-router";
import { useRooms, type Room } from "../../lib/useRooms";

const randomCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

type ModalMode = "create" | "join" | "rename" | "create-note";

export default function Dashboard() {
    const [userName, setUserName] = useState("User");
    const [menuVisible, setMenuVisible] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [modalMode, setModalMode] = useState<ModalMode | null>(null);
    const [name, setName] = useState("");
    const [code, setCode] = useState(randomCode());
    const [submitting, setSubmitting] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
    const [showActions, setShowActions] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const router = useRouter();
    const { rooms, loading, error, success, createRoom, joinRoom, leaveRoom, renameRoom } = useRooms();

    useFocusEffect(
        useCallback(() => {
            const getUser = async () => {
                try {
                    const { data, error } = await supabase.auth.getUser();
                    if (error) throw error;

                    const user = data.user;
                    if (!user) {
                        setUserName("User");
                        setUserId(null);
                        return;
                    }

                    const name = user.user_metadata?.full_name || user.email?.split('@')[0] || "User";
                    setUserName(name);
                    setUserId(user.id);
                } catch (error) {
                    console.error("Failed to load user after login:", error);
                    setUserName("User");
                    setUserId(null);
                }
            };
            getUser();
        }, [])
    );

    const openCreate = () => {
        setModalMode("create");
        setName("");
        setCode(randomCode());
    };

    const openCreateNote = () => {
        setModalMode("create-note");
        setName("");
        setCode("");
    };

    const openJoin = () => {
        setModalMode("join");
        setName("");
        setCode("");
    };

    const openRename = (room: Room) => {
        setSelectedRoom(room);
        setName(room.name);
        setModalMode("rename");
        setShowActions(false);
    };

    const closeModal = () => {
        setModalMode(null);
        setName("");
        setCode(randomCode());
        setSelectedRoom(null);
    };

    const submitModal = async () => {
        setSubmitting(true);
        let ok = false;

        if (modalMode === "create") {
            ok = await createRoom({ name, code });
        } else if (modalMode === "join") {
            ok = await joinRoom(code);
        } else if (modalMode === "rename") {
            ok = selectedRoom ? await renameRoom(selectedRoom.id, name) : false;
        } else if (modalMode === "create-note") {
            try {
                const title = name.trim();
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error("No user");
                if (!title) throw new Error("Note name is required.");

                const { data: existing } = await supabase
                    .from("notes")
                    .select("title")
                    .eq("user_id", user.id)
                    .is("room_id", null)
                    .eq("title", title)
                    .maybeSingle();

                if (existing) {
                    throw new Error("A note with this name already exists.");
                }

                const { encrypt } = await import("../../lib/crypto-safe");
                const encrypted = await encrypt("", user.id);
                const { error } = await supabase.from("notes").insert({
                    user_id: user.id,
                    room_id: null,
                    title,
                    ciphertext: encrypted.ciphertext,
                    iv: encrypted.iv,
                    salt: encrypted.salt,
                });

                if (error) throw error;
                closeModal();
                router.push({ pathname: "/note_editor", params: { title, isNew: "true" } });
                ok = true;
            } catch (error: any) {
                Alert.alert("Error", error.message || "Failed to create note");
            }
        }

        setSubmitting(false);
        if (ok && modalMode !== "create-note") closeModal();
    };

    const showRoomActions = (room: Room) => {
        setSelectedRoom(room);
        setShowActions(true);
    };

    const handleLeave = async () => {
        if (!selectedRoom) return;
        setSubmitting(true);
        const shouldDelete = selectedRoom.created_by === userId;
        const ok = await leaveRoom(selectedRoom.id, shouldDelete);
        setSubmitting(false);
        if (ok) {
            setShowDeleteConfirm(false);
            setShowActions(false);
            setSelectedRoom(null);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-950">
            <StatusBar style="light" />
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                <View className="flex-row justify-between items-center mb-8">
                    <View>
                        <Text className="text-slate-400 text-sm font-medium">Welcome back,</Text>
                        <Text className="text-white text-2xl font-bold">{userName}</Text>
                    </View>
                    <View className="flex-row items-center gap-3">
                        <Pressable
                            onPress={() => setMenuVisible(true)}
                            className="bg-blue-600 w-10 h-10 rounded-full items-center justify-center border border-blue-500 shadow-lg shadow-blue-500/20 active:bg-blue-700"
                        >
                            <Plus size={20} color="white" />
                        </Pressable>
                        <View className="w-10 h-10 bg-slate-800 rounded-full border border-slate-700 items-center justify-center">
                            <Text className="text-white font-bold">{userName[0]?.toUpperCase()}</Text>
                        </View>
                    </View>
                </View>

                <Text className="text-slate-400 font-semibold mb-4 uppercase text-xs tracking-wider">Quick Actions</Text>
                <View className="flex-row gap-4 mb-8">
                    <Pressable
                        onPress={() => setMenuVisible(true)}
                        className="flex-1 bg-blue-600/10 border border-blue-600/20 p-4 rounded-xl items-center gap-2 active:bg-blue-600/20"
                    >
                        <View className="w-10 h-10 bg-blue-600 rounded-lg items-center justify-center">
                            <Plus size={24} color="white" />
                        </View>
                        <Text className="text-blue-100 font-medium">New Upload</Text>
                    </Pressable>
                    <Pressable
                        onPress={openCreateNote}
                        className="flex-1 bg-slate-800/50 border border-slate-700/50 p-4 rounded-xl items-center gap-2 active:bg-slate-800"
                    >
                        <View className="w-10 h-10 bg-slate-700 rounded-lg items-center justify-center">
                            <FileText size={24} color="#94a3b8" />
                        </View>
                        <Text className="text-slate-300 font-medium">New Note</Text>
                    </Pressable>
                </View>

                <View className="flex-row items-center justify-between mb-4">
                    <Text className="text-slate-400 font-semibold uppercase text-xs tracking-wider">Rooms</Text>
                    <View className="flex-row gap-3">
                        <Pressable onPress={openJoin} className="bg-slate-800 border border-slate-700 px-4 py-3 rounded-xl min-w-[88px] items-center">
                            <Text className="text-slate-200 text-sm font-semibold">Join</Text>
                        </Pressable>
                        <Pressable onPress={openCreate} className="bg-blue-600 px-4 py-3 rounded-xl min-w-[88px] items-center">
                            <Text className="text-white text-sm font-bold">Create</Text>
                        </Pressable>
                    </View>
                </View>

                {(success || error) && (
                    <View className={`mb-4 rounded-xl px-4 py-3 border ${success ? "bg-emerald-600/15 border-emerald-500/20" : "bg-red-600/15 border-red-500/20"}`}>
                        <Text className={success ? "text-emerald-300" : "text-red-300"}>{success || error}</Text>
                    </View>
                )}

                {loading ? (
                    <View className="items-center justify-center py-20">
                        <ActivityIndicator size="large" color="#3b82f6" />
                    </View>
                ) : rooms.length === 0 ? (
                    <View className="items-center justify-center py-16 bg-slate-900/40 border border-slate-800 rounded-2xl">
                        <View className="w-16 h-16 rounded-full bg-slate-800/60 items-center justify-center mb-4">
                            <DoorOpen size={30} color="#64748b" />
                        </View>
                        <Text className="text-slate-300 text-lg font-semibold">No rooms yet</Text>
                        <Text className="text-slate-500 text-center mt-2 px-8">Create one or join with a room code to get started.</Text>
                    </View>
                ) : (
                    <View className="pb-6">
                        {rooms.map((item) => {
                            const isCreator = item.created_by === userId;
                            return (
                                <Pressable
                                    key={item.id}
                                    onPress={() => router.push({ pathname: "/rooms/[roomId]", params: { roomId: item.id, roomName: item.name } })}
                                    className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 mb-3 flex-row items-center"
                                >
                                    <View className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-600/20 items-center justify-center mr-4">
                                        <Users size={22} color="#60a5fa" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-white text-lg font-semibold" numberOfLines={1}>{item.name}</Text>
                                        <Text className="text-slate-500 text-sm">{isCreator ? "Creator" : "Member"}</Text>
                                    </View>
                                    <Pressable
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            showRoomActions(item);
                                        }}
                                        className="p-2 bg-slate-800 rounded-lg"
                                    >
                                        <EllipsisVertical size={18} color="#94a3b8" />
                                    </Pressable>
                                </Pressable>
                            );
                        })}
                    </View>
                )}
            </ScrollView>

            <Modal
                transparent
                visible={menuVisible}
                animationType="fade"
                onRequestClose={() => setMenuVisible(false)}
            >
                <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
                    <View className="flex-1 bg-black/60 justify-end p-4 pb-20">
                        <View className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                            <Pressable
                                onPress={() => {
                                    setMenuVisible(false);
                                    openCreateNote();
                                }}
                                className="p-4 flex-row items-center border-b border-slate-800 active:bg-slate-800"
                            >
                                <View className="w-10 h-10 bg-slate-800 rounded-lg items-center justify-center mr-4">
                                    <FileText size={20} color="#94a3b8" />
                                </View>
                                <View>
                                    <Text className="text-white font-bold text-lg">New Note</Text>
                                    <Text className="text-slate-400 text-sm">Create a new text note</Text>
                                </View>
                            </Pressable>

                            <Pressable
                                onPress={() => {
                                    setMenuVisible(false);
                                    router.push({ pathname: "/files", params: { autoUpload: "true" } });
                                }}
                                className="p-4 flex-row items-center border-b border-slate-800 active:bg-slate-800"
                            >
                                <View className="w-10 h-10 bg-blue-600/10 rounded-lg items-center justify-center mr-4">
                                    <Folder size={20} color="#3b82f6" />
                                </View>
                                <View>
                                    <Text className="text-white font-bold text-lg">Upload File</Text>
                                    <Text className="text-slate-400 text-sm">Upload documents to drive</Text>
                                </View>
                            </Pressable>

                            <Pressable
                                onPress={() => {
                                    setMenuVisible(false);
                                    router.push({ pathname: "/images", params: { autoUpload: "true" } });
                                }}
                                className="p-4 flex-row items-center active:bg-slate-800"
                            >
                                <View className="w-10 h-10 bg-purple-600/10 rounded-lg items-center justify-center mr-4">
                                    <ImageIcon size={20} color="#a855f7" />
                                </View>
                                <View>
                                    <Text className="text-white font-bold text-lg">Upload Image</Text>
                                    <Text className="text-slate-400 text-sm">Add photos to gallery</Text>
                                </View>
                            </Pressable>
                        </View>

                        <Pressable
                            onPress={() => setMenuVisible(false)}
                            className="mt-4 bg-slate-900 border border-slate-800 p-4 rounded-xl items-center active:bg-slate-800"
                        >
                            <Text className="text-white font-bold">Cancel</Text>
                        </Pressable>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            <Modal transparent visible={modalMode !== null} animationType="fade" onRequestClose={closeModal}>
                <View className="flex-1 bg-black/60 justify-center items-center p-4">
                    <View className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6">
                        <Text className="text-white text-xl font-bold mb-4">
                            {modalMode === "create"
                                ? "Create Room"
                                : modalMode === "join"
                                    ? "Join Room"
                                    : modalMode === "create-note"
                                        ? "New Note"
                                        : "Rename Room"}
                        </Text>

                        {(modalMode === "create" || modalMode === "rename" || modalMode === "create-note") && (
                            <View className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 mb-4">
                                <TextInput
                                    className="text-white text-base"
                                    placeholder={modalMode === "create-note" ? "Note name" : "Room name"}
                                    placeholderTextColor="#64748b"
                                    value={name}
                                    onChangeText={setName}
                                />
                            </View>
                        )}

                        {(modalMode === "create" || modalMode === "join") && (
                            <View className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 mb-6">
                                <TextInput
                                    className="text-white text-base"
                                    placeholder="Room code"
                                    placeholderTextColor="#64748b"
                                    value={code}
                                    onChangeText={setCode}
                                    autoCapitalize="characters"
                                />
                            </View>
                        )}

                        <View className="flex-row gap-3">
                            <Pressable onPress={closeModal} className="flex-1 bg-slate-800 rounded-xl py-3 items-center">
                                <Text className="text-slate-300 font-medium">Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={submitModal}
                                disabled={submitting || (modalMode !== "join" && !name.trim()) || ((modalMode === "join" || modalMode === "create") && !code.trim())}
                                className={`flex-1 bg-blue-600 rounded-xl py-3 items-center ${submitting ? "opacity-50" : ""}`}
                            >
                                {submitting ? <ActivityIndicator size="small" color="white" /> : <Text className="text-white font-bold">{modalMode === "rename" ? "Rename" : modalMode === "join" ? "Join" : "Create"}</Text>}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal transparent visible={showActions} animationType="fade" onRequestClose={() => setShowActions(false)}>
                <View className="flex-1 bg-black/60 justify-center items-center p-4">
                    <View className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6">
                        <Text className="text-white text-xl font-bold mb-1">{selectedRoom?.name || "Room"}</Text>
                        <Text className="text-slate-500 text-sm mb-6">Choose an action</Text>

                        {selectedRoom?.created_by === userId && (
                            <Pressable onPress={() => selectedRoom && openRename(selectedRoom)} className="bg-slate-800 rounded-xl py-3.5 items-center mb-3">
                                <Text className="text-white font-semibold">Rename</Text>
                            </Pressable>
                        )}

                        <Pressable onPress={() => { setShowActions(false); setShowDeleteConfirm(true); }} className="bg-red-600/20 border border-red-500/20 rounded-xl py-3.5 items-center mb-3">
                            <Text className="text-red-400 font-semibold">{selectedRoom?.created_by === userId ? "Delete Room" : "Leave Room"}</Text>
                        </Pressable>

                        <Pressable onPress={() => setShowActions(false)} className="bg-slate-800 rounded-xl py-3 items-center">
                            <Text className="text-slate-300 font-medium">Cancel</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            <Modal transparent visible={showDeleteConfirm} animationType="fade" onRequestClose={() => setShowDeleteConfirm(false)}>
                <View className="flex-1 bg-black/60 justify-center items-center p-4">
                    <View className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6">
                        <Text className="text-white text-xl font-bold mb-2">{selectedRoom?.created_by === userId ? "Delete Room" : "Leave Room"}</Text>
                        <Text className="text-slate-400 text-base mb-6">
                            {selectedRoom?.created_by === userId
                                ? `You are the creator of "${selectedRoom?.name}". Leaving will delete it for everyone.`
                                : `Are you sure you want to leave "${selectedRoom?.name}"?`}
                        </Text>
                        <View className="flex-row gap-3">
                            <Pressable onPress={() => setShowDeleteConfirm(false)} className="flex-1 bg-slate-800 rounded-xl py-3 items-center">
                                <Text className="text-slate-300 font-medium">Cancel</Text>
                            </Pressable>
                            <Pressable onPress={handleLeave} className="flex-1 bg-red-600 rounded-xl py-3 items-center">
                                {submitting ? <ActivityIndicator size="small" color="white" /> : <Text className="text-white font-bold">{selectedRoom?.created_by === userId ? "Delete" : "Leave"}</Text>}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
