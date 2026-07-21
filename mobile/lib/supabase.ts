import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import { createClient } from '@supabase/supabase-js'

type ExpoExtra = {
    supabaseUrl?: string;
    supabaseAnonKey?: string;
};

const expoExtra = (Constants.expoConfig?.extra || {}) as ExpoExtra;
const supabaseUrl =
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    expoExtra.supabaseUrl ||
    "https://placeholder.invalid";
const supabaseAnonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    expoExtra.supabaseAnonKey ||
    "missing-supabase-anon-key";

if (!process.env.EXPO_PUBLIC_SUPABASE_URL && !expoExtra.supabaseUrl) {
    console.warn("Supabase URL is missing. Falling back to a placeholder value.");
}

if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY && !expoExtra.supabaseAnonKey) {
    console.warn("Supabase anon key is missing. Falling back to a placeholder value.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
})
