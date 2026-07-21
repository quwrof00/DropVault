import 'react-native-url-polyfill/auto';
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { useEffect } from "react";
import "../global.css"

export default function RootLayout() {
    const [loaded] = useFonts({
        // Add custom fonts here if needed
    });

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                animation: "fade",
                contentStyle: {
                    flex: 1,
                    backgroundColor: "#020617",
                    paddingHorizontal: 12,
                    paddingTop: 12,
                },
            }}
        >
            <Stack.Screen name="index" />
        </Stack>
    );
}
