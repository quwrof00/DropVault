import 'react-native-url-polyfill/auto';
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { AuthProvider } from "../contexts/AuthContext";
import "../global.css"

export default function RootLayout() {
    const [loaded] = useFonts({
        // Add custom fonts here if needed
    });

    return (
        <AuthProvider>
            <Stack
                screenOptions={{
                    headerShown: false,
                    animation: "fade",
                    contentStyle: {
                        flex: 1,
                        backgroundColor: "#020617",
                    },
                }}
            >
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(app)" />
            </Stack>
        </AuthProvider>
    );
}
