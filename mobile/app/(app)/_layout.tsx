import { Stack, Redirect } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AppLayout() {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-slate-900 justify-center items-center">
                <ActivityIndicator size="large" color="#60a5fa" />
            </SafeAreaView>
        );
    }

    if (!user) {
        return <Redirect href="/(auth)" />;
    }

    return (
        <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="note_editor" />
        </Stack>
    );
}
