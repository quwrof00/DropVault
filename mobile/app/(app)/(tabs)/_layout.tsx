import { Tabs } from "expo-router";
import { Platform, View, Text } from "react-native";
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
                    backgroundColor: "#020617",
                    borderTopColor: "#1e293b",
                    height: Platform.OS === "ios" ? 90 : 85,
                    paddingTop: 8,
                    paddingBottom: Platform.OS === "ios" ? 25 : 15,
                },
                tabBarShowLabel: false,
                tabBarActiveTintColor: "#ffffff",
                tabBarInactiveTintColor: "#64748b",
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: "Home",
                    tabBarIcon: ({ color, size, focused }) => (
                        <View className={`items-center justify-center rounded-xl pt-2 pb-1 w-[4.5rem] ${focused ? 'bg-blue-600' : ''}`}>
                            <Home size={size} color={focused ? 'white' : color} />
                            <Text className={`text-[10px] font-semibold mt-0.5 ${focused ? 'text-white' : 'text-slate-500'}`}>Home</Text>
                        </View>
                    ),
                }}
            />
            <Tabs.Screen
                name="files"
                options={{
                    title: "Files",
                    tabBarIcon: ({ color, size, focused }) => (
                        <View className={`items-center justify-center rounded-xl pt-2 pb-1 w-[4.5rem] ${focused ? 'bg-blue-600' : ''}`}>
                            <Folder size={size} color={focused ? 'white' : color} />
                            <Text className={`text-[10px] font-semibold mt-0.5 ${focused ? 'text-white' : 'text-slate-500'}`}>Files</Text>
                        </View>
                    ),
                }}
            />
            <Tabs.Screen
                name="images"
                options={{
                    title: "Images",
                    tabBarIcon: ({ color, size, focused }) => (
                        <View className={`items-center justify-center rounded-xl pt-2 pb-1 w-[4.5rem] ${focused ? 'bg-blue-600' : ''}`}>
                            <ImageIcon size={size} color={focused ? 'white' : color} />
                            <Text className={`text-[10px] font-semibold mt-0.5 ${focused ? 'text-white' : 'text-slate-500'}`}>Images</Text>
                        </View>
                    ),
                }}
            />
            <Tabs.Screen
                name="notes"
                options={{
                    title: "Notes",
                    tabBarIcon: ({ color, size, focused }) => (
                        <View className={`items-center justify-center rounded-xl pt-2 pb-1 w-[4.5rem] ${focused ? 'bg-blue-600' : ''}`}>
                            <FileText size={size} color={focused ? 'white' : color} />
                            <Text className={`text-[10px] font-semibold mt-0.5 ${focused ? 'text-white' : 'text-slate-500'}`}>Notes</Text>
                        </View>
                    ),
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: "Settings",
                    tabBarIcon: ({ color, size, focused }) => (
                        <View className={`items-center justify-center rounded-xl pt-2 pb-1 w-[4.5rem] ${focused ? 'bg-blue-600' : ''}`}>
                            <SettingsIcon size={size} color={focused ? 'white' : color} />
                            <Text className={`text-[10px] font-semibold mt-0.5 ${focused ? 'text-white' : 'text-slate-500'}`}>Settings</Text>
                        </View>
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
