import { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, ActivityIndicator, Alert, Pressable, KeyboardAvoidingView, Platform, Share, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { supabase } from "../../lib/supabase";
import { ChevronLeft, Save, Check, FileText, MessageCircle, Copy, Share2, Maximize, Minimize } from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import { useItemCounts } from "../../lib/useItemCounts";
import ItemDiscussion from "../../components/ItemDiscussion";
import * as Clipboard from "expo-clipboard";
import { actions, RichEditor, RichToolbar } from "react-native-pell-rich-editor";
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
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);

    const richText = useRef<RichEditor>(null);
    const scrollRef = useRef<ScrollView>(null);
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
                .select("ciphertext, iv, salt, user_id, is_collaborative")
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
                const { decrypt } = await import("../../lib/crypto-safe");
                
                // Add a timeout in case decryption gets stuck (e.g. QuickCrypto native bug)
                const decrypted = await Promise.race([
                    decrypt({
                        ciphertext: data.ciphertext,
                        iv: data.iv,
                        salt: data.salt
                    }, roomId ?? user.id),
                    new Promise<string>((_, reject) => 
                        setTimeout(() => reject(new Error("Decryption timed out after 8 seconds.")), 8000)
                    )
                ]);

                const normalizedContent = htmlToPlainText(decrypted);

                if (isMounted.current) {
                    setContent(isNew ? "" : decrypted);
                    setLastSavedContent(isNew ? "" : decrypted);
                    setIsReadOnly(data.user_id !== user.id && !data.is_collaborative);
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
            return import("../../lib/crypto-safe").then(({ encrypt }) =>
                encrypt(contentToSave, roomId ?? user.id).then((encrypted) =>
                    supabase.from("notes").upsert({
                        user_id: user.id,
                        room_id: roomId ?? null,
                        title,
                        ciphertext: encrypted.ciphertext,
                        iv: encrypted.iv,
                        salt: encrypted.salt,
                        updated_at: new Date().toISOString(),
                        ...(isNew ? { is_collaborative: params.isCollaborative === "true" } : {}),
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

    useEffect(() => {
        const timer = setTimeout(() => {
            if (content !== lastSavedContent && !isLoading) {
                handleSave(content);
            }
        }, 3000);

        return () => clearTimeout(timer);
    }, [content, lastSavedContent, isLoading]);

    const handleCursorPosition = (scrollY: number) => {
        scrollRef.current?.scrollTo({ y: scrollY - 30, animated: true });
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-950">
            <StatusBar style="light" />
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            {!isFullScreen && (
                <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50">
                    <Pressable onPress={() => router.back()} className="p-2 -ml-2 rounded-full active:bg-slate-800">
                        <ChevronLeft size={24} color="#94a3b8" />
                    </Pressable>

                    <View className="flex-1 items-center mx-4">
                        <Text className="text-white font-bold text-lg text-center" numberOfLines={1}>
                            {title}
                        </Text>
                        <Text className="text-slate-400 text-[10px] mt-0.5 font-medium">
                            {isReadOnly ? "Read Only" : isSaving ? "Saving..." : content === lastSavedContent ? "Saved" : "Editing"}
                        </Text>
                    </View>

                    <View className="flex-row items-center gap-1 -mr-2">
                        <Pressable onPress={() => setIsFullScreen(true)} className="p-2 active:opacity-50">
                            <Maximize size={18} color="#cbd5e1" />
                        </Pressable>
                        <Pressable onPress={handleCopy} className="p-2 active:opacity-50">
                            <Copy size={18} color="#cbd5e1" />
                        </Pressable>
                        <Pressable onPress={handleShare} className="p-2 active:opacity-50">
                            <Share2 size={18} color="#cbd5e1" />
                        </Pressable>
                        {roomId && title && (
                            <Pressable
                                onPress={() => setIsDiscussionOpen((prev) => !prev)}
                                className="p-2 relative active:opacity-50"
                            >
                                <MessageCircle size={18} color={isDiscussionOpen ? "#3b82f6" : "#cbd5e1"} />
                                {noteCommentCount > 0 && (
                                    <View className="absolute top-0 right-0 min-w-[14px] h-[14px] rounded-full bg-red-500 items-center justify-center">
                                        <Text className="text-white text-[8px] font-bold">
                                            {noteCommentCount > 99 ? "99+" : noteCommentCount}
                                        </Text>
                                    </View>
                                )}
                            </Pressable>
                        )}
                        
                        {!isReadOnly && (
                            <View className="p-2 justify-center">
                                {isSaving ? (
                                    <ActivityIndicator size="small" color="#60a5fa" />
                                ) : content === lastSavedContent ? (
                                    <Check size={18} color="#4ade80" />
                                ) : (
                                    <Pressable onPress={() => handleSave(content)} className="active:opacity-50">
                                        <Save size={18} color="#94a3b8" />
                                    </Pressable>
                                )}
                            </View>
                        )}
                    </View>
                </View>
            )}

            {isLoading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#3b82f6" />
                    <Text className="text-slate-500 mt-4 mb-6">Decrypting note...</Text>
                    <Pressable 
                        onPress={() => router.back()}
                        className="bg-slate-800/80 px-6 py-2.5 rounded-xl border border-slate-700"
                    >
                        <Text className="text-slate-300 font-medium">Cancel</Text>
                    </Pressable>
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
                    className="flex-1"
                >
                    <View className="flex-1 bg-slate-900/60">


                        <View className="flex-1 relative">
                            {!isReadOnly && !isFullScreen && (
                                <RichToolbar
                                    editor={richText}
                                    actions={[
                                        actions.setBold,
                                        actions.setItalic,
                                        actions.setUnderline,
                                        actions.setStrikethrough,
                                        actions.heading1,
                                        actions.heading2,
                                        actions.insertBulletsList,
                                        actions.insertOrderedList,
                                        actions.removeFormat,
                                    ]}
                                    style={{ backgroundColor: '#1e293b' }}
                                    iconTint="#94a3b8"
                                    selectedIconTint="#3b82f6"
                                />
                            )}
                            
                            {isFullScreen && (
                                <View className="absolute bottom-6 right-6 z-50">
                                    <Pressable 
                                        onPress={() => setIsFullScreen(false)}
                                        className="bg-slate-800/80 p-3 rounded-full border border-slate-700 shadow-lg"
                                    >
                                        <Minimize size={20} color="white" />
                                    </Pressable>
                                </View>
                            )}
                            <ScrollView 
                                ref={scrollRef} 
                                className="flex-1" 
                                style={{ flex: 1 }}
                                contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
                                nestedScrollEnabled={true}
                                keyboardDismissMode="none"
                            >
                                <RichEditor
                                    ref={richText}
                                    initialContentHTML={content}
                                    onChange={setContent}
                                    placeholder={isReadOnly ? "" : "Start typing..."}
                                    onCursorPosition={handleCursorPosition}
                                    useContainer={false}
                                    disabled={isReadOnly}
                                    editorStyle={{
                                        backgroundColor: '#0f172a',
                                        color: 'white',
                                        placeholderColor: '#475569',
                                        cssText: `
                                            pre { background-color: #1e293b; color: #f8fafc; padding: 12px; border-radius: 8px; overflow-x: auto; }
                                            code { background-color: #1e293b; color: #f8fafc; padding: 2px 4px; border-radius: 4px; font-family: monospace; }
                                            pre code { padding: 0; background-color: transparent; }
                                            a { color: #3b82f6; text-decoration: none; }
                                        `
                                    }}
                                    style={{ flex: 1, minHeight: 400 }}
                                />
                            </ScrollView>
                        </View>
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
