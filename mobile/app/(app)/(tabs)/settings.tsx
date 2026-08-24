import { useState, useEffect } from "react";
import { View, Text, Pressable, Alert, TextInput, ActivityIndicator, Modal, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "../../../lib/supabase";
import { LogOut, User, Mail, Edit2, Check, X, ChevronRight, Activity as ActivityIcon, Trash2 } from "lucide-react-native";

interface Activity {
    id: number;
    action: string;
    target_name: string;
    created_at: string;
}

const getActionText = (action: string) => {
    switch (action) {
        case 'upload_image': return 'Uploaded image';
        case 'delete_image': return 'Deleted image';
        case 'upload_file': return 'Uploaded file';
        case 'delete_file': return 'Deleted file';
        case 'upload': return 'Uploaded file'; 
        case 'delete': return 'Deleted file'; 
        case 'create': return 'Created file'; 
        case 'created_room': return 'Created room';
        case 'joined_room': return 'Joined room';
        case 'deleted_room': return 'Deleted room';
        case 'left_room': return 'Left room';
        case 'create_note': return 'Created note';
        case 'delete_note': return 'Deleted note';
        case 'create_folder': return 'Created folder';
        case 'delete_folder': return 'Deleted folder';
        case 'create_snippet': return 'Created snippet';
        case 'delete_snippet': return 'Deleted snippet';
        default: return action.charAt(0).toUpperCase() + action.slice(1).replace(/_/g, ' ');
    }
};

export default function SettingsScreen() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isEditingName, setIsEditingName] = useState(false);
    const [newName, setNewName] = useState("");
    const [updating, setUpdating] = useState(false);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(true);

    useEffect(() => {
        getProfile();
    }, []);

    const getProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUser(user);
                setNewName(user.user_metadata?.full_name || user.email?.split('@')[0] || "User");
                fetchActivities(user.id);
            }
        } catch (error) {
            console.error("Error fetching user:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchActivities = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('activities')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(10);
            
            if (error) throw error;
            setActivities(data as Activity[] || []);
        } catch (error) {
            console.error("Error fetching activities:", error);
        } finally {
            setLoadingActivities(false);
        }
    };

    const handleDeleteActivity = async (activityId: number) => {
        if (!user) return;
        try {
            const { error } = await supabase.from('activities').delete().eq('id', activityId).eq('user_id', user.id);
            if (error) throw error;
            setActivities(prev => prev.filter(a => a.id !== activityId));
        } catch (err) {
            console.error("Failed to delete activity", err);
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
            <ScrollView contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: 16, paddingTop: 16 }} showsVerticalScrollIndicator={false}>
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
                        <View className="flex-row items-center gap-3 flex-1">
                            <View className="w-8 h-8 rounded-full bg-blue-500/10 items-center justify-center">
                                <Mail size={16} color="#60a5fa" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-slate-400 text-xs">Email Address</Text>
                                <Text className="text-slate-200 text-sm" numberOfLines={1}>{user?.email}</Text>
                            </View>
                        </View>
                    </View>

                    <View className="flex-row items-center justify-between p-3 bg-slate-800/50 rounded-xl">
                        <View className="flex-row items-center gap-3 flex-1">
                            <View className="w-8 h-8 rounded-full bg-purple-500/10 items-center justify-center">
                                <User size={16} color="#c084fc" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-slate-400 text-xs">User ID</Text>
                                <Text className="text-slate-500 text-[10px] font-mono" numberOfLines={1}>{user?.id}</Text>
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

            {/* Recent Activity Section */}
            <View className="mt-8">
                <Text className="text-white text-xl font-bold mb-4">Recent Activity</Text>
                
                <View className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                    {loadingActivities ? (
                        <View className="p-6 items-center justify-center">
                            <ActivityIndicator size="small" color="#3b82f6" />
                        </View>
                    ) : activities.length > 0 ? (
                        activities.map((activity, index) => (
                            <View 
                                key={activity.id} 
                                className={`flex-row items-start p-4 ${index < activities.length - 1 ? 'border-b border-slate-800' : ''}`}
                            >
                                <View className="w-8 h-8 rounded-full bg-blue-500/10 items-center justify-center mr-3 mt-1">
                                    <ActivityIcon size={16} color="#60a5fa" />
                                </View>
                                <View className="flex-1">
                                    <View className="flex-row items-center flex-wrap">
                                        <Text className="text-slate-200">{getActionText(activity.action)} </Text>
                                        <Text className="text-blue-400 font-medium">{activity.target_name}</Text>
                                    </View>
                                    <Text className="text-slate-500 text-xs mt-1">
                                        {new Date(activity.created_at).toLocaleString()}
                                    </Text>
                                </View>
                                <Pressable
                                    onPress={() => handleDeleteActivity(activity.id)}
                                    className="p-2 ml-2"
                                >
                                    <Trash2 size={16} color="#64748b" />
                                </Pressable>
                            </View>
                        ))
                    ) : (
                        <View className="p-6 items-center justify-center">
                            <Text className="text-slate-500">No recent activity found</Text>
                        </View>
                    )}
                </View>
            </View>
            </ScrollView>
        </SafeAreaView>
    );
}
