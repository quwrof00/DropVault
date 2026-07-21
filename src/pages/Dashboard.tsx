import { supabase } from "../lib/supabase-client";
import { useAuthUser } from "../hooks/useAuthUser";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardCard } from "../components/Dashboard/DashboardCard";
import { Image, Files, Notebook, Code, Clock, Trash2 } from "lucide-react";

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
    case 'upload': return 'Uploaded file'; // Legacy
    case 'delete': return 'Deleted file'; // Legacy
    case 'create': return 'Created file'; // Legacy
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

export default function Dashboard() {
  const user = useAuthUser();
  const navigate = useNavigate();
  const [activities, setActivities] = useState<Activity[]>([]);
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

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const [
          { data: imageData, error: imageError },
          { data: fileData, error: fileError },
          { count: noteCount, error: noteError },
          { count: codeCount, error: codeError },
          { data: activityData, error: activityError }
        ] = await Promise.all([
          supabase.storage.from("user-images").list(`${user.id}`),
          supabase.storage.from("user-files").list(`${user.id}`),
          supabase.from("notes").select("*", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("codes").select("*", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("activities").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5)
        ]);

        if (imageError || fileError || noteError || codeError) {
          throw new Error(imageError?.message || fileError?.message || noteError?.message || codeError?.message);
        }

        if (activityError) {
          console.error("Error fetching activities:", activityError);
        } else {
          setActivities(activityData as Activity[] || []);
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
        <div className="flex items-center space-x-3 text-gray-300">
          <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="font-medium">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-6 border-b border-gray-800">
          <h1 className="text-3xl font-bold">
            Dashboard <span className="text-gray-500 font-normal ml-2">|</span> <span className="text-gray-400 text-lg font-normal ml-2">{user?.email}</span>
          </h1>
          <div className="flex gap-4 mt-4 md:mt-0">
            <button 
              onClick={() => navigate('/main')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm font-medium"
            >
              Go to Workspace
            </button>
            <button 
              onClick={() => supabase.auth.signOut()}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 transition text-sm font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <DashboardCard
            title="Images"
            count={counts.images}
            icon={<Image size={24} />}
            onClick={() => navigate("/main")}
          />

          <DashboardCard
            title="Files"
            count={counts.files}
            icon={<Files size={24} />}
            onClick={() => navigate("/main")}
          />

          <DashboardCard
            title="Notes"
            count={counts.notes}
            icon={<Notebook size={24} />}
            onClick={() => navigate("/main")}
          />

          <DashboardCard
            title="Code Snippets"
            count={counts.codes}
            icon={<Code size={24} />}
            onClick={() => navigate("/main")}
          />
        </div>

        {/* Recent Activity Section */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <Clock className="text-gray-400" size={20} />
            <h2 className="text-xl font-semibold">Recent Activity</h2>
          </div>
          {activities.length > 0 ? (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-4 p-4 rounded-lg bg-gray-900/50 border border-gray-700/50 hover:bg-gray-800/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">
                      {getActionText(activity.action)}
                      <span className="text-blue-400 ml-2">{activity.target_name}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(activity.created_at).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteActivity(activity.id)}
                    className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded-md"
                    title="Delete activity"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-center py-12 border-2 border-dashed border-gray-700 rounded-lg">
              <p>No recent activity found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
