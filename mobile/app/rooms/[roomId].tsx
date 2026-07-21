import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, FileText, Folder, Image as ImageIcon, Plus, ChevronDown, ChevronRight } from "lucide-react-native";
import { NotesContent } from "../(tabs)/notes";
import { FilesContent } from "../(tabs)/files";
import { ImagesContent } from "../(tabs)/images";
import { supabase } from "../../lib/supabase";

type Section = "Notes" | "Files" | "Images";
type RoomMember = {
    id: string;
    email: string;
};

export default function RoomScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const roomId = params.roomId as string;
    const roomName = (params.roomName as string) || "Room";
    const [section, setSection] = useState<Section>("Notes");
    const [addAction, setAddAction] = useState<(() => void) | null>(null);
    const [members, setMembers] = useState<RoomMember[]>([]);
    const [membersOpen, setMembersOpen] = useState(false);

    useEffect(() => {
        const fetchMembers = async () => {
            const { data: auth } = await supabase.auth.getUser();
            const currentUser = auth.user;

            const { data: roomUsers, error: roomUsersError } = await supabase
                .from("room_users")
                .select("user_id")
                .eq("room_id", roomId);

            if (roomUsersError || !roomUsers?.length) {
                setMembers([]);
                return;
            }

            const userIds = roomUsers.map((entry) => entry.user_id);
            const { data: users } = await supabase
                .from("users")
                .select("id, email")
                .in("id", userIds);

            const nextMembers = userIds.map((id) => {
                const matchedUser = users?.find((user) => user.id === id);
                const email = matchedUser?.email || (id === currentUser?.id ? (currentUser?.email || "You") : "Unknown Member");
                return {
                    id,
                    email: id === currentUser?.id ? `${email} (You)` : (email || "Unknown Member"),
                };
            });

            setMembers(Array.from(new Map(nextMembers.map((member) => [member.id, member])).values()));
        };

        fetchMembers();

        const channel = supabase
            .channel(`room-members:${roomId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "room_users",
                    filter: `room_id=eq.${roomId}`,
                },
                () => {
                    fetchMembers();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [roomId]);

    const addLabel = section === "Notes" ? "Note" : "Upload";
    const registerAddAction = useCallback((action: (() => void) | null) => {
        setAddAction(() => action);
    }, []);

    return (
        <SafeAreaView className="flex-1 bg-slate-950">
            <Stack.Screen options={{ headerShown: false }} />
            <View className="pb-3">
                <View className="flex-row items-center mb-5">
                    <Pressable onPress={() => router.back()} className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 items-center justify-center mr-3">
                        <ChevronLeft size={20} color="#94a3b8" />
                    </Pressable>
                    <View className="flex-1">
                        <Text className="text-white text-2xl font-bold" numberOfLines={1}>{roomName}</Text>
                        <Text className="text-slate-500 text-sm">Shared workspace</Text>
                    </View>
                    {addAction && (
                        <Pressable
                            onPress={addAction}
                            className="bg-blue-600 px-4 py-2 rounded-lg flex-row items-center"
                        >
                            <Plus size={18} color="white" />
                            <Text className="text-white font-bold ml-1">{addLabel}</Text>
                        </Pressable>
                    )}
                </View>

                <View className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 mb-4">
                    <Pressable
                        onPress={() => setMembersOpen((prev) => !prev)}
                        className="flex-row items-center justify-between"
                    >
                        <View>
                            <Text className="text-white font-semibold">Room Members</Text>
                            <Text className="text-slate-500 text-sm">{members.length} members</Text>
                        </View>
                        {membersOpen ? <ChevronDown size={18} color="#94a3b8" /> : <ChevronRight size={18} color="#94a3b8" />}
                    </Pressable>

                    {membersOpen && (
                        members.length === 0 ? (
                            <Text className="text-slate-500 text-sm mt-3">No members found</Text>
                        ) : (
                            <View className="gap-2 mt-3">
                                {members.map((member) => (
                                    <View key={member.id} className="flex-row items-center justify-between bg-slate-800/80 rounded-xl px-3 py-2.5">
                                        <Text className="text-slate-200 text-sm flex-1" numberOfLines={1}>
                                            {member.email}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )
                    )}
                </View>

                <View className="bg-slate-900/70 border border-slate-800 rounded-2xl p-1.5 flex-row gap-1.5">
                    {[
                        { key: "Notes", icon: FileText },
                        { key: "Files", icon: Folder },
                        { key: "Images", icon: ImageIcon },
                    ].map(({ key, icon: Icon }) => (
                        <Pressable
                            key={key}
                            onPress={() => setSection(key as Section)}
                            className={`flex-1 flex-row items-center justify-center rounded-xl py-3 ${section === key ? "bg-slate-800" : ""}`}
                        >
                            <Icon size={16} color={section === key ? "#ffffff" : "#94a3b8"} />
                            <Text className={`ml-2 font-medium ${section === key ? "text-white" : "text-slate-400"}`}>{key}</Text>
                        </Pressable>
                    ))}
                </View>
            </View>

            <View className="flex-1">
                {section === "Notes" && <NotesContent roomId={roomId} embedded registerAddAction={registerAddAction} />}
                {section === "Files" && <FilesContent roomId={roomId} embedded registerAddAction={registerAddAction} />}
                {section === "Images" && <ImagesContent roomId={roomId} embedded registerAddAction={registerAddAction} />}
            </View>
        </SafeAreaView>
    );
}
