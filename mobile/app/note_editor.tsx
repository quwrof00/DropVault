import { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, ActivityIndicator, Alert, Pressable, KeyboardAvoidingView, Platform, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { supabase } from "../lib/supabase";
import { ChevronLeft, Save, Check, FileText, MessageCircle } from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import { useItemCounts } from "../lib/useItemCounts";
import ItemDiscussion from "../components/ItemDiscussion";
import * as Clipboard from "expo-clipboard";

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

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

const plainTextToHtml = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "<p></p>";

    return trimmed
        .split(/\n{2,}/)
        .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
        .join("");
};

export default function NoteEditorScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const title = params.title as string;
    const isNew = params.isNew === "true";
    const roomId = params.roomId as string | undefined;

    const [content, setContent] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSavedContent, setLastSavedContent] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isDiscussionOpen, setIsDiscussionOpen] = useState(false);

    const isMounted = useRef(true);
    const saveInProgress = useRef(false);
    const itemCounts = useItemCounts(roomId, "note");
    const noteCommentCount = roomId && title ? (itemCounts[title] || 0) : 0;

    useEffect(() => {
        isMounted.current = true;
        loadNote();
        return () => { isMounted.current = false; };
    }, [title]);

    const loadNote = async () => {
        if (!title) return;

        // If new, just start empty
        if (isNew) {
            setIsLoading(false);
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No user");

            let query = supabase
                .from("notes")
                .select("ciphertext, iv, salt")
                .eq("title", title);

            query = roomId
                ? query.eq("room_id", roomId)
                : query.eq("user_id", user.id).is("room_id", null);

            const { data, error } = await query.single();

            if (error) throw error;
            if (!data) {
                // Determine if it was just created but empty? 
                // Alternatively, treat as empty.
                setContent("");
                setLastSavedContent("");
            } else {
                // Decrypt
                const { decrypt } = await import("../lib/crypto-safe");
                const decrypted = await decrypt({
                    ciphertext: data.ciphertext,
                    iv: data.iv,
                    salt: data.salt
                }, roomId ?? user.id);

                const normalizedContent = htmlToPlainText(decrypted);

                if (isMounted.current) {
                    setContent(normalizedContent);
                    setLastSavedContent(normalizedContent);
                }
            }
        } catch (err: any) {
            console.error("Load error:", err);
            setError("Failed to load/decrypt note");
        } finally {
            if (isMounted.current) setIsLoading(false);
        }
    };

    // Fires in the background — never blocks UI or navigation
    const handleSave = (contentToSave: string) => {
        if (!title) return;
        if (contentToSave === lastSavedContent && !isNew) return;
        if (saveInProgress.current) return;

        saveInProgress.current = true;
        if (isMounted.current) setIsSaving(true);

        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user) throw new Error("No user");
            return import("../lib/crypto-safe").then(({ encrypt }) =>
                encrypt(plainTextToHtml(contentToSave), roomId ?? user.id).then((encrypted) =>
                    supabase.from("notes").upsert({
                        user_id: roomId ? null : user.id,
                        room_id: roomId ?? null,
                        title,
                        ciphertext: encrypted.ciphertext,
                        iv: encrypted.iv,
                        salt: encrypted.salt,
                        updated_at: new Date().toISOString(),
                    }, { onConflict: roomId ? "room_id,title" : "user_id,title" })
                )
            );
        }).then(({ error }) => {
            if (error) throw error;
            if (isMounted.current) {
                setLastSavedContent(contentToSave);
            }
        }).catch((err: any) => {
            console.error("Save error:", err);
        }).finally(() => {
            saveInProgress.current = false;
            if (isMounted.current) setIsSaving(false);
        });
    };

    const handleCopy = () => {
        Clipboard.setStringAsync(content).then(() => {
            Alert.alert("Copied", "Note content copied to clipboard");
        }).catch((err) => {
            console.error("Copy note error:", err);
            Alert.alert("Error", "Failed to copy note");
        });
    };

    const handleShare = async () => {
        try {
            await Share.share({
                title,
                message: `${title}\n\n${content}`,
            });
        } catch (err: any) {
            console.error("Share note error:", err);
            Alert.alert("Error", "Failed to share note");
        }
    };

    // Auto-save: debounced, fully non-blocking
    useEffect(() => {
        const timer = setTimeout(() => {
            if (content !== lastSavedContent && !isLoading) {
                handleSave(content);
            }
        }, 3000);

        return () => clearTimeout(timer);
    }, [content, lastSavedContent, isLoading]);

    return (
        <SafeAreaView className="flex-1 bg-slate-950">
            <StatusBar style="light" />
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50">
                <Pressable onPress={() => router.back()} className="p-2 -ml-2 rounded-full active:bg-slate-800">
                    <ChevronLeft size={24} color="#94a3b8" />
                </Pressable>

                <Text className="text-white font-bold text-lg flex-1 text-center mx-4" numberOfLines={1}>
                    {title}
                </Text>

                <View className="w-8 items-end justify-center">
                    {isSaving ? (
                        <ActivityIndicator size="small" color="#60a5fa" />
                    ) : content === lastSavedContent ? (
                        <Check size={20} color="#4ade80" />
                    ) : (
                        <Pressable onPress={() => handleSave(content)}>
                            <Save size={20} color="#94a3b8" />
                        </Pressable>
                    )}
                </View>
            </View>

            {isLoading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#3b82f6" />
                    <Text className="text-slate-500 mt-4">Decrypting note...</Text>
                </View>
            ) : error ? (
                <View className="flex-1 items-center justify-center p-6">
                    <Text className="text-red-400 text-center mb-4">{error}</Text>
                    <Pressable onPress={loadNote} className="bg-slate-800 px-4 py-2 rounded-lg">
                        <Text className="text-white">Retry</Text>
                    </Pressable>
                </View>
            ) : (
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    className="flex-1 p-4"
                >
                    <View className="flex-1 bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
                        <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900">
                            <View className="flex-row items-center">
                                <View className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 items-center justify-center mr-3">
                                    <FileText size={16} color="#60a5fa" />
                                </View>
                                <View>
                                    <Text className="text-white font-semibold">Editor</Text>
                    <Text className="text-slate-500 text-xs">
                        {roomId ? "Room note" : "Plain text on mobile, web-friendly saving"}
                    </Text>
                                </View>
                            </View>

                            <View className="px-2.5 py-1 rounded-full bg-slate-800">
                                <Text className="text-slate-400 text-xs">
                                    {isSaving ? "Saving..." : content === lastSavedContent ? "Saved" : "Editing"}
                                </Text>
                            </View>
                        </View>

                        <View className="flex-row gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900/70">
                            <Pressable
                                onPress={handleCopy}
                                className="flex-1 bg-slate-800 py-3 rounded-xl items-center"
                            >
                                <Text className="text-white font-semibold">Copy</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleShare}
                                className="flex-1 bg-slate-800 py-3 rounded-xl items-center"
                            >
                                <Text className="text-white font-semibold">Share</Text>
                            </Pressable>
                        </View>

                        {roomId && title && (
                            <View className="px-4 py-3 border-b border-slate-800 bg-slate-900/70">
                                <Pressable
                                    onPress={() => setIsDiscussionOpen((prev) => !prev)}
                                    className="bg-slate-800 py-3 rounded-xl items-center justify-center flex-row"
                                >
                                    <View className="relative">
                                        <MessageCircle size={18} color="#cbd5e1" />
                                        {noteCommentCount > 0 && (
                                            <View className="absolute -top-2 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 items-center justify-center">
                                                <Text className="text-white text-[10px] font-bold">
                                                    {noteCommentCount > 99 ? "99+" : noteCommentCount}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text className="text-white font-semibold ml-2">
                                        {isDiscussionOpen ? "Hide Discussion" : "Show Discussion"}
                                    </Text>
                                </Pressable>
                            </View>
                        )}

                        <TextInput
                            className="flex-1 text-white text-base p-4"
                            textAlignVertical="top"
                            multiline
                            placeholder="Start typing..."
                            placeholderTextColor="#475569"
                            value={content}
                            onChangeText={setContent}
                            style={{ lineHeight: 24 }}
                        />
                    </View>

                    {roomId && title && isDiscussionOpen && (
                        <View className="mt-4">
                            <ItemDiscussion itemId={title} itemType="note" roomId={roomId} />
                        </View>
                    )}
                </KeyboardAvoidingView>
            )}
        </SafeAreaView>
    );
}
