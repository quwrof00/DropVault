import { supabase } from "../lib/supabase-client";
import { useAuthUser } from "../hooks/useAuthUser";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardCard } from "../components/Dashboard/DashboardCard";

export default function Dashboard() {
  const user = useAuthUser();
  const navigate = useNavigate();
  const [counts, setCounts] = useState<{
    images: number;
    files: number;
    notes: number;
    codes: number;
    loading: boolean;
    error: string | null;
  }>({
    images: 0,
    files: 0,
    notes: 0,
    codes: 0,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const [
          { data: imageData, error: imageError },
          { data: fileData, error: fileError },
          { count: noteCount, error: noteError },
          { count: codeCount, error: codeError }
        ] = await Promise.all([
          supabase.storage.from("user-images").list(`${user.id}`),
          supabase.storage.from("user-files").list(`${user.id}`),
          supabase.from("notes").select("*", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("codes").select("*", { count: "exact", head: true }).eq("user_id", user.id)
        ]);

        if (imageError || fileError || noteError || codeError) {
          throw new Error(imageError?.message || fileError?.message || noteError?.message || codeError?.message);
        }

        setCounts({
          images: imageData?.length || 0,
          files: fileData?.length || 0,
          notes: noteCount || 0,
          codes: codeCount || 0,
          loading: false,
          error: null
        });
      } catch (error: any) {
        console.error(error);
        setCounts(prev => ({
          ...prev,
          loading: false,
          error: error?.message || "Unknown error",
        }));
      }
    };

    fetchData();
  }, [user]);

  if (counts.loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-400 border-r-transparent"></div>
          <p className="mt-4 text-gray-300">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (counts.error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <div className="text-center text-red-400">
          <p>Error loading dashboard data</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-300">
          Dashboard <span className="text-base md:text-lg font-light text-gray-400 align-middle">
            | {user?.email}
          </span>
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <DashboardCard
            title="Images"
            count={counts.images}
            icon="🖼️"
            color="from-purple-500 to-indigo-500"
            onClick={() => navigate("/main")}
          />

          <DashboardCard
            title="Files"
            count={counts.files}
            icon="📁"
            color="from-green-500 to-teal-500"
            onClick={() => navigate("/main")}
          />

          <DashboardCard
            title="Notes"
            count={counts.notes}
            icon="📝"
            color="from-yellow-500 to-amber-500"
            onClick={() => navigate("/main")}
          />

          <DashboardCard
            title="Code Snippets"
            count={counts.codes}
            icon="💻"
            color="from-red-500 to-pink-500"
            onClick={() => navigate("/main")}
          />
        </div>

        {/* Recent Activity Section */}
        <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
          <h2 className="text-2xl font-semibold mb-6 text-gray-200">Recent Activity</h2>
          <div className="text-gray-400 text-center py-8">
            <p>Your recent activity will appear here</p>
          </div>
        </div>
      </div>
    </div>
  );
}
