import { Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronDown, ChevronUp, X } from "lucide-react-native";
import { useState } from "react";
import ItemDiscussion from "./ItemDiscussion";

type DiscussionSheetProps = {
    visible: boolean;
    onClose: () => void;
    title: string;
    itemId: string;
    itemType: "note" | "file" | "image";
    roomId: string;
    count?: number;
};

export default function DiscussionSheet({
    visible,
    onClose,
    title,
    itemId,
    itemType,
    roomId,
    count = 0,
}: DiscussionSheetProps) {
    const [expanded, setExpanded] = useState(false);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/60 justify-end">
                <Pressable className="flex-1" onPress={onClose} />
                <SafeAreaView
                    edges={["bottom"]}
                    className={`bg-slate-950 border-t border-slate-800 rounded-t-3xl px-4 pt-4 ${expanded ? "h-[85%]" : "h-[60%]"}`}
                >
                    <View className="flex-row items-center justify-between mb-4">
                        <View className="flex-1 pr-4">
                            <Text className="text-white text-lg font-bold" numberOfLines={1}>{title}</Text>
                            <Text className="text-slate-500 text-sm">{count} comments</Text>
                        </View>

                        <View className="flex-row items-center gap-2">
                            <Pressable
                                onPress={() => setExpanded((prev) => !prev)}
                                className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center"
                            >
                                {expanded ? <ChevronDown size={20} color="#cbd5e1" /> : <ChevronUp size={20} color="#cbd5e1" />}
                            </Pressable>
                            <Pressable
                                onPress={onClose}
                                className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center"
                            >
                                <X size={20} color="#cbd5e1" />
                            </Pressable>
                        </View>
                    </View>

                    <View className="flex-1 pb-4">
                        <ItemDiscussion itemId={itemId} itemType={itemType} roomId={roomId} />
                    </View>
                </SafeAreaView>
            </View>
        </Modal>
    );
}
