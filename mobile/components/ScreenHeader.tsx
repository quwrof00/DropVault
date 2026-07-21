import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Plus } from "lucide-react-native";

type ScreenHeaderProps = {
    title: string;
    onAdd?: () => void;
    addLabel?: string;
    loading?: boolean;
    disabled?: boolean;
};

export default function ScreenHeader({
    title,
    onAdd,
    addLabel = "Add",
    loading = false,
    disabled = false
}: ScreenHeaderProps) {
    return (
        <View className="flex-row justify-between items-center mb-6">
            <Text className="text-white text-2xl font-bold">{title}</Text>
            {onAdd && (
                <Pressable
                    onPress={onAdd}
                    disabled={disabled || loading}
                    className={`bg-blue-600 px-4 py-2 rounded-lg flex-row items-center ${disabled || loading ? 'opacity-50' : 'active:bg-blue-700'}`}
                >
                    {loading ? (
                        <ActivityIndicator size="small" color="white" />
                    ) : (
                        <>
                            <Plus size={18} color="white" className="mr-1" />
                            <Text className="text-white font-bold">{addLabel}</Text>
                        </>
                    )}
                </Pressable>
            )}
        </View>
    );
}
