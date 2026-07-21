import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { FileText, Home, Folder, Settings as SettingsIcon, Image as ImageIcon } from "lucide-react-native";

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                animation: "fade",
                sceneStyle: {
                    flex: 1,
                    backgroundColor: "#020617",
                    paddingHorizontal: 12,
                    paddingTop: 12,
                },
                tabBarStyle: {
                    backgroundColor: "#020617", // slate-950
                    borderTopColor: "#1e293b", // slate-800
                    height: Platform.OS === "ios" ? 85 : 65,
                    paddingTop: 5,
                    paddingBottom: Platform.OS === "ios" ? 25 : 10,
                },
                tabBarActiveTintColor: "#3b82f6", // blue-500
                tabBarInactiveTintColor: "#64748b", // slate-500
                tabBarLabelStyle: {
                    fontWeight: "600",
                    fontSize: 10,
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: "Home",
                    tabBarIcon: ({ color, size }) => (
                        <Home size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="files"
                options={{
                    title: "Files",
                    tabBarIcon: ({ color, size }) => (
                        <Folder size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="images"
                options={{
                    title: "Images",
                    tabBarIcon: ({ color, size }) => (
                        <ImageIcon size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="notes"
                options={{
                    title: "Notes",
                    tabBarIcon: ({ color, size }) => (
                        <FileText size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: "Settings",
                    tabBarIcon: ({ color, size }) => (
                        <SettingsIcon size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="rooms"
                options={{
                    href: null,
                }}
            />
        </Tabs>
    );
}
