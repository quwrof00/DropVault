import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Mail, Lock, Eye, EyeOff, ArrowLeft, ShieldCheck, ChevronRight } from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import * as Linking from "expo-linking";
import { supabase } from "../lib/supabase";

export default function LoginScreen() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        email: "",
        password: "",
    });
    const [resetEmail, setResetEmail] = useState("");
    const [showReset, setShowReset] = useState(false);
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

    const handleLogin = async () => {
        if (!formData.email || !formData.password) {
            Alert.alert("Error", "Please fill in all fields");
            return;
        }

        setIsLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: formData.email,
                password: formData.password,
            });

            if (error) {
                Alert.alert("Login Failed", error.message);
            } else {
                router.replace("/(tabs)");
            }
        } catch (e: any) {
            Alert.alert("Error", e.message || "An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!resetEmail.trim()) {
            Alert.alert("Error", "Please enter your email");
            return;
        }

        setIsLoading(true);
        try {
            const redirectTo = Linking.createURL("/login");
            const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
                redirectTo,
            });

            if (error) {
                Alert.alert("Reset Failed", error.message);
            } else {
                Alert.alert("Email Sent", "Password reset link sent. Check your email.");
                setShowReset(false);
                setResetEmail("");
            }
        } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to send reset link");
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
                    {!showReset ? (
                        <>
                            <View className="items-center mb-8">
                                <View className="w-16 h-16 bg-blue-500/10 rounded-2xl items-center justify-center border border-blue-500/20 mb-4">
                                    <ShieldCheck size={32} color="#60a5fa" />
                                </View>
                                <Text className="text-3xl font-bold text-white mb-2">Welcome Back</Text>
                                <Text className="text-slate-400 text-center">Sign in to continue to your workspace</Text>
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
                                            onChangeText={(text) => setFormData((prev) => ({ ...prev, email: text }))}
                                        />
                                    </View>
                                </View>

                                <View>
                                    <View className="flex-row items-center justify-between mb-1.5 ml-1">
                                        <Text className="text-slate-300 font-medium">Password</Text>
                                        <Pressable onPress={() => setShowReset(true)} disabled={isLoading}>
                                            <Text className="text-xs font-medium text-blue-400">Forgot password?</Text>
                                        </Pressable>
                                    </View>
                                    <View className="flex-row items-center bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3">
                                        <Lock size={20} color="#64748b" />
                                        <TextInput
                                            className="flex-1 ml-3 text-white text-base"
                                            placeholder="Password"
                                            placeholderTextColor="#64748b"
                                            secureTextEntry={!showPassword}
                                            value={formData.password}
                                            onChangeText={(text) => setFormData((prev) => ({ ...prev, password: text }))}
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

                                <Pressable
                                    onPress={handleLogin}
                                    disabled={isLoading}
                                    className={`bg-blue-600 py-4 rounded-xl items-center justify-center mt-6 flex-row active:bg-blue-700 ${isLoading ? "opacity-70" : ""}`}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <>
                                            <Text className="text-white font-bold text-lg mr-2">Sign In</Text>
                                            <ChevronRight size={20} color="white" />
                                        </>
                                    )}
                                </Pressable>

                                <View className="flex-row justify-center mt-6">
                                    <Text className="text-slate-400">New to DropVault? </Text>
                                    <Pressable onPress={() => router.push("/register")}>
                                        <Text className="text-blue-400 font-semibold">Create account</Text>
                                    </Pressable>
                                </View>
                            </View>
                        </>
                    ) : (
                        <>
                            <View className="items-center mb-8">
                                <View className="w-16 h-16 bg-blue-500/10 rounded-2xl items-center justify-center border border-blue-500/20 mb-4">
                                    <Mail size={32} color="#60a5fa" />
                                </View>
                                <Text className="text-3xl font-bold text-white mb-2">Reset Password</Text>
                                <Text className="text-slate-400 text-center">Enter your email to receive recovery instructions.</Text>
                            </View>

                            <Pressable onPress={() => setShowReset(false)} className="flex-row items-center mb-6">
                                <ArrowLeft size={16} color="#94a3b8" />
                                <Text className="text-slate-400 ml-2">Back to login</Text>
                            </Pressable>

                            <View>
                                <Text className="text-slate-300 font-medium mb-1.5 ml-1">Email Address</Text>
                                <View className="flex-row items-center bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3">
                                    <Mail size={20} color="#64748b" />
                                    <TextInput
                                        className="flex-1 ml-3 text-white text-base"
                                        placeholder="you@example.com"
                                        placeholderTextColor="#64748b"
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                        value={resetEmail}
                                        onChangeText={setResetEmail}
                                    />
                                </View>
                            </View>

                            <Pressable
                                onPress={handleResetPassword}
                                disabled={isLoading}
                                className={`bg-blue-600 py-4 rounded-xl items-center justify-center mt-6 flex-row active:bg-blue-700 ${isLoading ? "opacity-70" : ""}`}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text className="text-white font-bold text-lg">Send Reset Link</Text>
                                )}
                            </Pressable>
                        </>
                    )}
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
