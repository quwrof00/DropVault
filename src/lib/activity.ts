import { supabase } from "./supabase-client";
import { apiUrl } from "./backend";

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

    const response = await fetch(apiUrl("/activity"), {
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
