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
  const [isMembersCollapsed, setIsMembersCollapsed] = useState(false);

  useEffect(() => {
    const fetchMembers = async () => {
      if (!roomId) {
        setRoomMembers([]);
        return;
      }

      setIsLoadingMembers(true);

      try {
        // First try to fetch via relationship
        const { data: joinedData, error: joinError } = await supabase
          .from("room_users")
          .select("user_id, users(email)")
          .eq("room_id", roomId);

        if (!joinError && joinedData) {
          // Map the joined data
          const validMembers = joinedData.map((item: any) => ({
            id: item.user_id,
            email: item.users?.email || "Unknown User"
          }));
          setRoomMembers(validMembers);
          return;
        }

        // Fallback: Fetch IDs then fetch user details (for when FK might be missing or different schema)
        const { data: roomUsers, error: roomError } = await supabase
          .from("room_users")
          .select("user_id")
          .eq("room_id", roomId);

        if (roomError) throw roomError;

        if (!roomUsers?.length) {
          setRoomMembers([]);
          return;
        }

        const userIds = roomUsers.map((u) => u.user_id);
        const { data: users, error: userError } = await supabase
          .from("users")
          .select("id, email")
          .in("id", userIds);

        // Even if userError happens (e.g. RLS), we can at least show we have members
        if (userError) {
          console.warn("Could not fetch user details", userError);
          // Show generic members if we can't get details
          setRoomMembers(userIds.map(id => ({ id, email: "Member" })));
        } else {
          setRoomMembers(users || []);
        }

      } catch (err) {
        console.error("Error fetching members:", err);
        // Don't show error UI, just show empty
      } finally {
        setIsLoadingMembers(false);
      }
    };

    fetchMembers();

    // Optional: Realtime subscription could go here
    const channel = supabase
      .channel('room-users-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_users', filter: `room_id=eq.${roomId}` },
        () => {
          fetchMembers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };

  }, [roomId]);

  return (
    <div className="w-64 bg-gray-950 border-r border-gray-800 text-gray-300 flex flex-col h-screen">
      {/* Header */}
      <div className="p-6 border-b border-gray-800/50 flex items-center gap-3">
        <span className="text-2xl filter drop-shadow-md">🧳</span>
        <h2 className="text-xl font-bold text-gray-100 tracking-tight">My Vault</h2>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-3 space-y-8">
        {/* Sections */}
        <nav className="space-y-1">
          <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Modules
          </p>
          {sections.map((item) => (
            <button
              key={item.name}
              onClick={() => onSelect(item.name)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${activeSection === item.name
                  ? "bg-blue-600/10 text-blue-400"
                  : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"
                }`}
            >
              <span className={`text-lg transition-transform group-hover:scale-110 ${activeSection === item.name ? "opacity-100" : "opacity-70"}`}>
                {item.icon}
              </span>
              <span>{item.name}</span>
            </button>
          ))}
        </nav>

        {/* Members Section */}
        {roomId && (
          <div>
            <div className="flex items-center justify-between px-3 mb-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Room Members ({roomMembers.length})
              </h3>
              <button
                onClick={() => setIsMembersCollapsed(!isMembersCollapsed)}
                className="text-gray-500 hover:text-gray-300 transition-colors"
                title={isMembersCollapsed ? "Expand" : "Collapse"}
              >
                <svg
                  className={`w-4 h-4 transform transition-transform duration-200 ${isMembersCollapsed ? "-rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {!isMembersCollapsed && (
              <div className="space-y-1 px-1">
                {isLoadingMembers ? (
                  <div className="flex items-center space-x-2 px-2 py-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-600 border-t-blue-500"></div>
                    <span className="text-xs text-gray-500">Loading...</span>
                  </div>
                ) : roomMembers.length > 0 ? (
                  <ul className="space-y-1">
                    {roomMembers.map((member) => (
                      <li
                        key={member.id}
                        className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-gray-800/30 transition-colors group"
                      >
                        <div className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 border border-gray-700/50 group-hover:border-gray-600">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                        </div>
                        <span className="text-sm text-gray-400 truncate max-w-[140px]" title={member.email}>
                          {member.email}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-2 text-xs text-gray-600 italic">No members found</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer / User info could go here */}
      <div className="p-4 border-t border-gray-800/50">
        <div className="text-xs text-gray-600 text-center">
          DropVault v1.0
        </div>
      </div>
    </div>
  );
};

export default Sidebar;