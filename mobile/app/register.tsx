import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Mail, Lock, Eye, EyeOff, ArrowLeft, UserPlus, ChevronRight } from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import { supabase } from "../lib/supabase";

export default function RegisterScreen() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const checkSession = async () => {
            const { data } = await supabase.auth.getSession();
            if (!isMounted) return;
            if (data.session) {
                router.replace("/(tabs)");
            }
        };

        checkSession();

        return () => {
            isMounted = false;
        };
    }, [router]);

    const handleRegister = async () => {
        if (!formData.email || !formData.password || !formData.confirmPassword) {
            Alert.alert("Error", "Please fill in all fields");
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            Alert.alert("Error", "Passwords do not match");
            return;
        }

        setIsLoading(true);
        try {
            const { error } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
            });

            if (error) {
                Alert.alert("Registration Failed", error.message);
            } else {
                Alert.alert(
                    "Success",
                    "Registration successful! Please check your email to verify your account.",
                    [{ text: "OK", onPress: () => router.replace("/login") }]
                );
            }
        } catch (e: any) {
            Alert.alert("Error", e.message || "An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-950">
            <StatusBar style="light" />

            <View style={styles.screen}>
                <Pressable
                    onPress={() => router.back()}
                    className="w-10 h-10 items-center justify-center rounded-full bg-slate-800/50"
                    style={styles.backButton}
                >
                    <ArrowLeft size={20} color="#94a3b8" />
                </Pressable>

                <View style={styles.formShell} className="flex-1 justify-center">
                <View className="items-center mb-8">
                    <View className="w-16 h-16 bg-blue-500/10 rounded-2xl items-center justify-center border border-blue-500/20 mb-4">
                        <UserPlus size={32} color="#60a5fa" />
                    </View>
                    <Text className="text-3xl font-bold text-white mb-2">Create Account</Text>
                    <Text className="text-slate-400 text-center">Join DropVault to start securing your files</Text>
                </View>

                <View className="space-y-4">
                    <View>
                        <Text className="text-slate-300 font-medium mb-1.5 ml-1">Email</Text>
                        <View className="flex-row items-center bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3">
                            <Mail size={20} color="#64748b" />
                            <TextInput
                                className="flex-1 ml-3 text-white text-base"
                                placeholder="you@example.com"
                                placeholderTextColor="#64748b"
                                autoCapitalize="none"
                                keyboardType="email-address"
                                value={formData.email}
                                onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))}
                            />
                        </View>
                    </View>

                    <View>
                        <Text className="text-slate-300 font-medium mb-1.5 ml-1">Password</Text>
                        <View className="flex-row items-center bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3">
                            <Lock size={20} color="#64748b" />
                            <TextInput
                                className="flex-1 ml-3 text-white text-base"
                                placeholder="••••••••"
                                placeholderTextColor="#64748b"
                                secureTextEntry={!showPassword}
                                value={formData.password}
                                onChangeText={(text) => setFormData(prev => ({ ...prev, password: text }))}
                            />
                            <Pressable onPress={() => setShowPassword(!showPassword)}>
                                {showPassword ? (
                                    <EyeOff size={20} color="#64748b" />
                                ) : (
                                    <Eye size={20} color="#64748b" />
                                )}
                            </Pressable>
                        </View>
                    </View>

                    <View>
                        <Text className="text-slate-300 font-medium mb-1.5 ml-1">Confirm Password</Text>
                        <View className="flex-row items-center bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3">
                            <Lock size={20} color="#64748b" />
                            <TextInput
                                className="flex-1 ml-3 text-white text-base"
                                placeholder="••••••••"
                                placeholderTextColor="#64748b"
                                secureTextEntry={true}
                                value={formData.confirmPassword}
                                onChangeText={(text) => setFormData(prev => ({ ...prev, confirmPassword: text }))}
                            />
                        </View>
                    </View>

                    <Pressable
                        onPress={handleRegister}
                        disabled={isLoading}
                        className={`bg-blue-600 py-4 rounded-xl items-center justify-center mt-6 flex-row active:bg-blue-700 ${isLoading ? 'opacity-70' : ''}`}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <>
                                <Text className="text-white font-bold text-lg mr-2">Sign Up</Text>
                                <ChevronRight size={20} color="white" />
                            </>
                        )}
                    </Pressable>

                    <View className="flex-row justify-center mt-6">
                        <Text className="text-slate-400">Already have an account? </Text>
                        <Pressable onPress={() => router.back()}>
                            <Text className="text-blue-400 font-semibold">Sign in</Text>
                        </Pressable>
                    </View>
                </View>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        paddingHorizontal: 16,
        justifyContent: "center",
    },
    formShell: {
        width: "100%",
        maxWidth: 384,
        alignSelf: "center",
    },
    backButton: {
        position: "absolute",
        top: 16,
        left: 16,
        zIndex: 1,
    },
});
