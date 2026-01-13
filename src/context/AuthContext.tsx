import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase-client";
import type { User } from "@supabase/supabase-js";

interface AuthContextType {
    user: User | null | undefined;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: undefined, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null | undefined>(undefined);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            const { data } = await supabase.auth.getUser();
            setUser(data?.user ?? null);
            setLoading(false);
        };

        initAuth();

        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => {
            listener.subscription.unsubscribe();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
