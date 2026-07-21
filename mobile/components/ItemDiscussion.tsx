import { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable, ActivityIndicator, PanResponder } from "react-native";
import { supabase } from "../lib/supabase";

type Comment = {
    id: string;
    content: string;
    created_at: string;
    user_id: string;
    user_email?: string | null;
    room_id: string | null;
    item_type: string;
    item_id: string;
};

type ItemDiscussionProps = {
    itemId: string;
    itemType: "note" | "file" | "image";
    roomId?: string;
};

export default function ItemDiscussion({ itemId, itemType, roomId }: ItemDiscussionProps) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [discussionHeight, setDiscussionHeight] = useState(260);
    const scrollRef = useRef<ScrollView | null>(null);
    const startHeightRef = useRef(260);

    useEffect(() => {
        const fetchComments = async () => {
            if (!itemId || !roomId) return;

            setLoading(true);

            const { data: auth } = await supabase.auth.getUser();
            setCurrentUserId(auth.user?.id ?? null);

            const { data, error } = await supabase
                .from("item_comments")
                .select("*")
                .eq("item_id", itemId)
                .eq("item_type", itemType)
                .eq("room_id", roomId)
                .order("created_at", { ascending: true });

            if (!error) {
                setComments((data as Comment[]) || []);
            }

            setLoading(false);
        };

        fetchComments();

        if (!roomId) return;

        const channel = supabase
            .channel(`discussion:${roomId}:${itemType}:${itemId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "item_comments",
                },
                (payload) => {
                    const newComment = payload.new as Comment;
                    if (newComment.room_id !== roomId) return;
                    if (newComment.item_id !== itemId) return;
                    if (newComment.item_type !== itemType) return;

                    setComments((prev) => (
                        prev.some((comment) => comment.id === newComment.id)
                            ? prev
                            : [...prev, newComment]
                    ));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [itemId, itemType, roomId]);

    useEffect(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
    }, [comments]);

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 4,
            onPanResponderGrant: () => {
                startHeightRef.current = discussionHeight;
            },
            onPanResponderMove: (_, gestureState) => {
                const nextHeight = Math.max(180, Math.min(520, startHeightRef.current - gestureState.dy));
                setDiscussionHeight(nextHeight);
            },
        })
    ).current;

    const handleSend = async () => {
        const content = message.trim();
        if (!content || !roomId) return;

        try {
            setSending(true);
            const { data: auth } = await supabase.auth.getUser();
            const user = auth.user;
            if (!user) return;

            const { data, error } = await supabase
                .from("item_comments")
                .insert({
                    item_id: itemId,
                    item_type: itemType,
                    room_id: roomId,
                    user_id: user.id,
                    user_email: user.email,
                    content,
                })
                .select()
                .single();

            if (error) throw error;

            if (data) {
                setComments((prev) => (
                    prev.some((comment) => comment.id === data.id)
                        ? prev
                        : [...prev, data as Comment]
                ));
            }
            setMessage("");
        } finally {
            setSending(false);
        }
    };

    return (
        <View className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
            <View className="px-4 py-3 border-b border-slate-800 bg-slate-900 flex-row items-center justify-between">
                <Text className="text-white font-semibold">Discussion</Text>
                <View className="px-2 py-1 rounded-full bg-slate-800">
                    <Text className="text-slate-400 text-xs">{comments.length}</Text>
                </View>
            </View>

            <View
                {...panResponder.panHandlers}
                className="items-center justify-center py-2 bg-slate-900 border-b border-slate-800"
            >
                <View className="w-12 h-1.5 rounded-full bg-slate-700" />
                <Text className="text-slate-500 text-[11px] mt-1">Drag to resize</Text>
            </View>

            <ScrollView
                ref={scrollRef}
                style={{ height: discussionHeight }}
                contentContainerStyle={{ padding: 16, gap: 12 }}
                showsVerticalScrollIndicator={false}
            >
                {loading ? (
                    <View className="py-6 items-center">
                        <ActivityIndicator size="small" color="#60a5fa" />
                    </View>
                ) : comments.length === 0 ? (
                    <Text className="text-slate-500 text-sm text-center py-4">No comments yet. Start the discussion.</Text>
                ) : comments.map((comment) => {
                    const isMe = comment.user_id === currentUserId;

                    return (
                        <View key={comment.id} className={isMe ? "items-end" : "items-start"}>
                            <Text className="text-slate-500 text-[11px] mb-1">
                                {(comment.user_email || "User").split("@")[0]}
                            </Text>
                            <View className={`max-w-[85%] rounded-2xl px-3 py-2 ${isMe ? "bg-blue-600" : "bg-slate-800"}`}>
                                <Text className="text-white text-sm">{comment.content}</Text>
                            </View>
                            <Text className="text-slate-600 text-[10px] mt-1">
                                {new Date(comment.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </Text>
                        </View>
                    );
                })}
            </ScrollView>

            <View className="p-3 border-t border-slate-800 bg-slate-900 flex-row gap-2">
                <TextInput
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white"
                    placeholder="Type a message..."
                    placeholderTextColor="#64748b"
                    value={message}
                    onChangeText={setMessage}
                />
                <Pressable
                    onPress={handleSend}
                    disabled={sending || !message.trim()}
                    className={`px-4 rounded-xl items-center justify-center bg-blue-600 ${sending || !message.trim() ? "opacity-50" : ""}`}
                >
                    <Text className="text-white font-semibold">Send</Text>
                </Pressable>
            </View>
        </View>
    );
}
