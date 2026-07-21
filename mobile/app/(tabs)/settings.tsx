import { useState, useEffect } from "react";
import { View, Text, Pressable, Alert, TextInput, ActivityIndicator, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { LogOut, User, Mail, Edit2, Check, X, ChevronRight } from "lucide-react-native";

export default function SettingsScreen() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isEditingName, setIsEditingName] = useState(false);
    const [newName, setNewName] = useState("");
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        getProfile();
    }, []);

    const getProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUser(user);
                setNewName(user.user_metadata?.full_name || user.email?.split('@')[0] || "User");
            }
        } catch (error) {
            console.error("Error fetching user:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateName = async () => {
        if (!user || !newName.trim()) return;

        setUpdating(true);
        try {
            const { data, error } = await supabase.auth.updateUser({
                data: { full_name: newName.trim() }
            });

            if (error) throw error;

            setUser(data.user);
            setIsEditingName(false);
            Alert.alert("Success", "Profile updated successfully");
        } catch (error: any) {
            Alert.alert("Error", error.message);
        } finally {
            setUpdating(false);
        }
    };

    const handleLogout = async () => {
        Alert.alert(
            "Sign Out",
            "Are you sure you want to sign out?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Sign Out",
                    style: "destructive",
                    onPress: async () => {
                        const { error } = await supabase.auth.signOut();
                        if (error) {
                            Alert.alert("Error", error.message);
                        } else {
                            router.replace("/login");
                        }
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-slate-950 items-center justify-center">
                <ActivityIndicator size="large" color="#3b82f6" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-slate-950">
            <Text className="text-white text-2xl font-bold mb-8">Settings</Text>

            {/* Profile Section */}
            <View className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 mb-8">
                <View className="items-center mb-6">
                    <View className="w-20 h-20 bg-slate-800 rounded-full items-center justify-center border border-slate-700 mb-3">
                        <Text className="text-3xl font-bold text-slate-400">
                            {(user?.user_metadata?.full_name?.[0] || user?.email?.[0] || "U").toUpperCase()}
                        </Text>
                    </View>


                    <Text className="text-slate-500 mt-1">{user?.email}</Text>
                </View>

                {/* Info Rows */}
                <View className="space-y-4">
                    <View className="flex-row items-center justify-between p-3 bg-slate-800/50 rounded-xl">
                        <View className="flex-row items-center gap-3">
                            <View className="w-8 h-8 rounded-full bg-blue-500/10 items-center justify-center">
                                <Mail size={16} color="#60a5fa" />
                            </View>
                            <View>
                      
                                     <Text className="text-slate-400 text-xs">Email Address</Text>
                     
                    
                               
                        
                                <Text className="text-slate-200 text-sm">{user?.email}</Text>
                            </View>
                        </View>
                        
                    </View>

                    <View className="flex-row items-center justify-between p-3 bg-slate-800/50 rounded-xl">
                        <View className="flex-row items-center gap-3">
                            <View className="w-8 h-8 rounded-full bg-purple-500/10 items-center justify-center">
                                <User size={16} color="#c084fc" />
                            </View>
                            <View>
                                <Text className="text-slate-400 text-xs">User ID</Text>
                                <Text className="text-slate-500 text-[10px] font-mono">{user?.id}</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </View>

            {/* Actions */}
            <View className="gap-3">
                <Pressable
                    onPress={handleLogout}
                    className="bg-red-500/5 border border-red-500/20 p-4 rounded-xl flex-row items-center justify-between active:bg-red-500/10 transition-colors"
                >
                    <View className="flex-row items-center gap-3">
                        <LogOut size={20} color="#ef4444" />
                        <Text className="text-red-400 font-medium">Sign Out</Text>
                    </View>
                    <ChevronRight size={16} color="#7f1d1d" />
                </Pressable>
            </View>
        </SafeAreaView>
    );
}
