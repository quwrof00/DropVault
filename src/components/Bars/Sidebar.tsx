import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase-client";
import { Image, Folder, FileText, Code, Box, X, ChevronDown, User } from "lucide-react";

type RoomUser = {
  id: string;
  email: string;
};

type SidebarProps = {
  onSelect: (section: string) => void;
  activeSection?: string;
  className?: string; // Allow external styling (for width/position)
  onClose?: () => void; // Allow closing from within sidebar (mobile)
};

const sections = [
  { name: "Images", icon: <Image size={18} /> },
  { name: "Files", icon: <Folder size={18} /> },
  { name: "Notes", icon: <FileText size={18} /> },
  { name: "Code", icon: <Code size={18} /> },
];

const Sidebar = ({ onSelect, activeSection, className = "", onClose }: SidebarProps) => {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get("roomId");
  const [roomMembers, setRoomMembers] = useState<RoomUser[]>([]);
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
    <div className={`bg-gray-950 border-r border-gray-800 text-gray-300 flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-800/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600/20 p-2 rounded-lg text-blue-400">
            <Box size={24} />
          </div>
          <h2 className="text-xl font-bold text-gray-100 tracking-tight">My Vault</h2>
        </div>
        {onClose && (
          <button onClick={onClose} className="md:hidden text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-3 space-y-8 custom-scrollbar">
        {/* Sections */}
        <nav className="space-y-1">
          <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Modules
          </p>
          {sections.map((item) => (
            <button
              key={item.name}
              onClick={() => {
                onSelect(item.name);
                if (onClose) onClose();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${activeSection === item.name
                ? "bg-blue-600/10 text-blue-400"
                : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"
                }`}
            >
              <span className={`transition-transform group-hover:scale-110 ${activeSection === item.name ? "opacity-100" : "opacity-70"}`}>
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
                <ChevronDown
                  size={16}
                  className={`transform transition-transform duration-200 ${isMembersCollapsed ? "-rotate-90" : ""}`}
                />
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
                          <User size={14} />
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