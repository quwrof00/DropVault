import { Stack, Redirect } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AuthLayout() {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-slate-900 justify-center items-center">
                <ActivityIndicator size="large" color="#60a5fa" />
            </SafeAreaView>
        );
    }

    if (user) {
        return <Redirect href="/(app)/(tabs)" />;
    }

    return (
        <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
        </Stack>
    );
}
