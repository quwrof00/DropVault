import { useEffect, useState } from "react";
import { View, Text, Pressable, Modal, TextInput, ActivityIndicator, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { DoorOpen, EllipsisVertical, Users } from "lucide-react-native";
import ScreenHeader from "../../components/ScreenHeader";
import { useRooms, type Room } from "../../lib/useRooms";
import { supabase } from "../../lib/supabase";

const randomCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

type ModalMode = "create" | "join" | "rename";

export default function RoomsScreen() {
    const router = useRouter();
    const { rooms, loading, error, success, createRoom, joinRoom, leaveRoom, renameRoom } = useRooms();
    const [modalMode, setModalMode] = useState<ModalMode | null>(null);
    const [name, setName] = useState("");
    const [code, setCode] = useState(randomCode());
    const [submitting, setSubmitting] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
    const [showActions, setShowActions] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    }, []);

    const openCreate = () => {
        setModalMode("create");
        setName("");
        setCode(randomCode());
    };

    const openJoin = () => {
        setModalMode("join");
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
        const ok =
            modalMode === "create"
                ? await createRoom({ name, code })
                : modalMode === "join"
                    ? await joinRoom(code)
                    : selectedRoom
                        ? await renameRoom(selectedRoom.id, name)
                        : false;

        setSubmitting(false);
        if (ok) closeModal();
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

    const renderItem = ({ item }: { item: Room }) => {
        const isCreator = item.created_by === userId;
        return (
            <Pressable
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
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-950">
            <ScreenHeader title="Rooms" onAdd={openCreate} addLabel="Create" />

            <View className="flex-row gap-3 mb-5">
                <Pressable onPress={openCreate} className="flex-1 bg-blue-600 rounded-xl py-3 items-center">
                    <Text className="text-white font-bold">Create Room</Text>
                </Pressable>
                <Pressable onPress={openJoin} className="flex-1 bg-slate-800 border border-slate-700 rounded-xl py-3 items-center">
                    <Text className="text-slate-200 font-semibold">Join Room</Text>
                </Pressable>
            </View>

            {(success || error) && (
                <View className={`mb-4 rounded-xl px-4 py-3 border ${success ? "bg-emerald-600/15 border-emerald-500/20" : "bg-red-600/15 border-red-500/20"}`}>
                    <Text className={success ? "text-emerald-300" : "text-red-300"}>{success || error}</Text>
                </View>
            )}

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#3b82f6" />
                </View>
            ) : rooms.length === 0 ? (
                <View className="flex-1 items-center justify-center pb-20">
                    <View className="w-20 h-20 rounded-full bg-slate-800/50 items-center justify-center mb-4">
                        <DoorOpen size={36} color="#64748b" />
                    </View>
                    <Text className="text-slate-300 text-lg font-semibold">No rooms yet</Text>
                    <Text className="text-slate-500 text-center mt-2">Create one or join with a room code.</Text>
                </View>
            ) : (
                <FlatList
                    data={rooms}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 24 }}
                    showsVerticalScrollIndicator={false}
                />
            )}

            <Modal transparent visible={modalMode !== null} animationType="fade" onRequestClose={closeModal}>
                <View className="flex-1 bg-black/60 justify-center items-center p-4">
                    <View className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6">
                        <Text className="text-white text-xl font-bold mb-4">
                            {modalMode === "create" ? "Create Room" : modalMode === "join" ? "Join Room" : "Rename Room"}
                        </Text>

                        {(modalMode === "create" || modalMode === "rename") && (
                            <View className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 mb-4">
                                <TextInput
                                    className="text-white text-base"
                                    placeholder="Room name"
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
