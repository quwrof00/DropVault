import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase-client";

type User = {
  id: string;
  email: string;
};

type SidebarProps = {
  onSelect: (section: string) => void;
  activeSection?: string;
};

const sections = [
  { name: "Images", icon: "🖼️" },
  { name: "Files", icon: "📁" },
  { name: "Notes", icon: "📝" },
  { name: "Code", icon: "💻" },
];

const Sidebar = ({ onSelect, activeSection }: SidebarProps) => {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get("roomId");
  const [roomMembers, setRoomMembers] = useState<User[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMembersCollapsed, setIsMembersCollapsed] = useState(false);

  useEffect(() => {
    const fetchMembers = async () => {
      if (!roomId) {
        setRoomMembers([]);
        return;
      }

      setIsLoadingMembers(true);
      setError(null);

      try {
        // Fetch user_ids from room_users
        const { data: roomUsers, error: roomError } = await supabase
          .from("room_users")
          .select("user_id")
          .eq("room_id", roomId);

        if (roomError) {
          throw new Error(`Failed to fetch room members: ${roomError.message}`);
        }

        if (!roomUsers?.length) {
          setRoomMembers([]);
          return;
        }

        const userIds = roomUsers.map((u) => u.user_id);

        // Fetch users by IDs
        const { data: users, error: userError } = await supabase
          .from("users")
          .select("id, email")
          .in("id", userIds);

        if (userError) {
          throw new Error(`Failed to fetch users: ${userError.message}`);
        }

        setRoomMembers(users || []);
      } catch (err: any) {
        console.error(err);
        setError("Failed to load room members. Please try again.");
        setRoomMembers([]);
      } finally {
        setIsLoadingMembers(false);
      }
    };

    fetchMembers();
  }, [roomId]);

  return (
    <div className="w-64 bg-gray-900 text-white min-h-screen p-6 flex flex-col space-y-6 shadow-xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">🧳</span>
        <h2 className="text-2xl font-bold text-white">My Vault</h2>
      </div>

      {/* Sections */}
      <nav className="space-y-2">
        {sections.map((item) => (
          <button
            key={item.name}
            onClick={() => onSelect(item.name)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeSection === item.name
                ? "bg-gray-800 text-white font-semibold border-l-4 border-blue-500"
                : "text-gray-300 hover:bg-gray-800 hover:text-white"
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span>{item.name}</span>
          </button>
        ))}
      </nav>

      {/* Members Section */}
      {roomId && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-200">Room Members</h3>
            <button
              onClick={() => setIsMembersCollapsed(!isMembersCollapsed)}
              className="text-gray-400 hover:text-white transition-colors duration-200"
            >
              <svg
                className={`w-5 h-5 transform ${isMembersCollapsed ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {isLoadingMembers && (
            <div className="flex items-center space-x-2 py-3">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-600 border-t-blue-500"></div>
              <p className="text-gray-400 text-sm">Loading members...</p>
            </div>
          )}

          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">
              {error}
            </div>
          )}

          {!isLoadingMembers && !error && roomMembers.length === 0 && (
            <p className="text-gray-500 text-sm">No members found in this room.</p>
          )}

          {!isMembersCollapsed && !isLoadingMembers && roomMembers.length > 0 && (
            <ul className="space-y-2">
              {roomMembers.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center gap-3 px-3 py-2 text-gray-300 text-sm hover:bg-gray-800 rounded-lg transition-all duration-200"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-300">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                  <span className="truncate" title={member.email}>
                    {member.email}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default Sidebar;