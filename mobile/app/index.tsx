import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Text, View, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function WelcomeScreen() {
    const router = useRouter();
    const [checkingSession, setCheckingSession] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const checkSession = async () => {
            const { data } = await supabase.auth.getSession();
            if (!isMounted) return;

            if (data.session) {
                router.replace("/(tabs)");
                return;
            }

            setCheckingSession(false);
        };

        checkSession();

        return () => {
            isMounted = false;
        };
    }, [router]);

    if (checkingSession) {
        return (
            <SafeAreaView className="flex-1 bg-slate-900">
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#60a5fa" />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-slate-900">
            <View style={styles.screen}>
                <View style={styles.card} className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700/50 items-center">
                    <Text className="text-4xl font-bold text-white mb-2 text-center">
                        DropVault
                    </Text>
                    <Text className="text-slate-400 text-center mb-8">
                        Your secure, collaborative workspace on the go.
                    </Text>

                    <Pressable
                        onPress={() => router.push("/login")}
                        className="bg-blue-600 py-3.5 px-6 rounded-xl w-full active:bg-blue-700"
                    >
                        <Text className="text-white font-semibold text-center text-lg">
                            Get Started
                        </Text>
                    </Pressable>
                </View>
                <StatusBar style="light" />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
    },
    card: {
        width: "100%",
        maxWidth: 384,
    },
});
