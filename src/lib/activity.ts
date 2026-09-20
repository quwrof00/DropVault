import { supabase } from "./supabase-client";

const API_URL = import.meta.env.VITE_API_URL || "/api";

export async function logActivity(userId: string, action: string, targetName?: string) {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}/activity`, {
      method: "POST",
      headers,
      body: JSON.stringify({ userId, action, targetName }),
    });

    if (!response.ok) {
      console.error("Failed to log activity:", await response.text());
    }
  } catch (error) {
    console.error("Error logging activity:", error);
  }
}
