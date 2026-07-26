const API_URL = import.meta.env.VITE_API_URL || "/api";

export async function logActivity(userId: string, action: string, targetName?: string) {
  try {
    const response = await fetch(`${API_URL}/activity`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, action, targetName }),
    });

    if (!response.ok) {
      console.error("Failed to log activity:", await response.text());
    }
  } catch (error) {
    console.error("Error logging activity:", error);
  }
}
