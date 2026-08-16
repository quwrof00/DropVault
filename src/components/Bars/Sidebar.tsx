import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase-client";
import { useAuth } from "../../context/AuthContext";
import { Image, Folder, FileText, Code, Box, X, ChevronDown, User, Eye, EyeOff, Copy, Check } from "lucide-react";
import { getUserColorClasses } from "../../lib/colors";

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
    const { user: currentUser } = useAuth();
    const [searchParams] = useSearchParams();
    const roomId = searchParams.get("roomId");
    const [roomMembers, setRoomMembers] = useState<RoomUser[]>([]);
    const [isLoadingMembers, setIsLoadingMembers] = useState(false);
    const [isMembersCollapsed, setIsMembersCollapsed] = useState(false);
    const [roomCode, setRoomCode] = useState<string | null>(null);
    const [showCode, setShowCode] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        const fetchMembers = async () => {
            if (!roomId) {
                setRoomMembers([]);
                return;
            }

            setIsLoadingMembers(true);

            try {
                // 1. Fetch all user IDs in the room (Source of Truth)
                const { data: roomUsers, error: roomError } = await supabase
                    .from("room_users")
                    .select("user_id")
                    .eq("room_id", roomId);

                if (roomError) {
                    console.error("Error fetching room users:", roomError);
                    return;
                }

                if (!roomUsers?.length) {
                    setRoomMembers([]);
                    return;
                }

                const userIds = roomUsers.map((u) => u.user_id);

                // 2. Fetch user details for these IDs
                const { data: users, error: userError } = await supabase
                    .from("users")
                    .select("id, email")
                    .in("id", userIds);

                if (userError) {
                    console.warn("Error fetching user details:", userError);
                    // If fetching details fails, still show the members as Unknown
                }

                // 3. Merge: Ensure every roomUser is represented
                const validMembers = userIds.map(id => {
                    const userProfile = users?.find(u => u.id === id);

                    let email = "Unknown Member";
                    if (userProfile?.email) {
                        email = userProfile.email;
                    } else if (id === currentUser?.id && currentUser?.email) {
                        email = currentUser.email + " (You)";
                    }

                    return {
                        id: id,
                        email: email
                    };
                });

                // Remove duplicates if any (though logic shouldn't produce them)
                const uniqueMembers = Array.from(new Map(validMembers.map(item => [item.id, item])).values());

                setRoomMembers(uniqueMembers);

            } catch (err) {
                console.error("Unexpected error fetching members:", err);
            } finally {
                setIsLoadingMembers(false);
            }
        };

        const fetchRoomDetails = async () => {
            if (!roomId) {
                setRoomCode(null);
                return;
            }
            const { data } = await supabase
                .from("rooms")
                .select("code")
                .eq("id", roomId)
                .single();

            if (data) {
                setRoomCode(data.code);
            }
        };

        fetchMembers();
        fetchRoomDetails();

        // Realtime subscription
        const channel = supabase
            .channel(`room-users-${roomId}`)
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
        <div className={`bg-gray-950 border-r border-gray-800 text-gray-300 flex flex-col h-full ${isCollapsed ? 'md:w-20' : 'md:w-64'} ${className}`}>
            {/* Header */}
            <div className={`p-4 border-b border-gray-800/50 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
                {!isCollapsed && (
                    <div className="flex flex-col gap-1 overflow-hidden">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-600/20 p-2 rounded-lg text-blue-400 flex-shrink-0">
                                <Box size={24} />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-xl font-bold text-gray-100 tracking-tight truncate">
                                    {roomId ? "Room Vault" : "My Vault"}
                                </h2>
                            </div>
                        </div>

                        {roomId && roomCode && (
                            <div className="flex items-center gap-2 mt-2 ml-1">
                                <button
                                    onClick={() => setShowCode(!showCode)}
                                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-400"
                                    title={showCode ? "Hide Code" : "Show Code"}
                                >
                                    {showCode ? <EyeOff size={14} /> : <Eye size={14} />}
                                    <span className="font-medium">
                                        {showCode ? roomCode : "****"}
                                    </span>
                                </button>
                                {showCode && (
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(roomCode);
                                            setCopied(true);
                                            setTimeout(() => setCopied(false), 2000);
                                        }}
                                        className="text-gray-500 hover:text-green-400"
                                        title="Copy Code"
                                    >
                                        {copied ? <Check size={14} /> : <Copy size={14} />}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {isCollapsed && (
                    <div className="bg-blue-600/20 p-2 rounded-lg text-blue-400 flex-shrink-0 mb-4 hidden md:block" title={roomId ? "Room Vault" : "My Vault"}>
                        <Box size={24} />
                    </div>
                )}

                {/* Mobile Close */}
                {onClose && (
                    <button onClick={onClose} className="md:hidden text-gray-400 hover:text-white ml-auto">
                        <X size={24} />
                    </button>
                )}

                {/* Desktop Toggle - Absolute positioned or just part of flow */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className={`hidden md:flex text-gray-500 hover:text-white p-1 rounded hover:bg-gray-800 ${isCollapsed ? 'absolute top-6' : ''}`}
                    title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    {isCollapsed ? <ChevronDown className="-rotate-90" size={20} /> : <ChevronDown className="rotate-90" size={20} />}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto py-6 px-3 space-y-8 custom-scrollbar">
                {/* Sections */}
                <nav className="space-y-2">
                    {sections.map((item) => (
                        <button
                            key={item.name}
                            onClick={() => {
                                onSelect(item.name);
                                if (onClose) onClose();
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium group ${activeSection === item.name
                                ? "bg-blue-600/10 text-blue-400"
                                : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"
                                } ${isCollapsed ? 'justify-center' : ''}`}
                            title={isCollapsed ? item.name : undefined}
                        >
                            <span className={` group- ${activeSection === item.name ? "opacity-100" : "opacity-70"}`}>
                                {item.icon}
                            </span>
                            {!isCollapsed && <span>{item.name}</span>}
                        </button>
                    ))}
                </nav>

                {/* Members Section */}
                {roomId && (
                    <div>
                        {!isCollapsed && (
                            <div className="flex items-center justify-between px-3 mb-2">
                                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Room Members ({roomMembers.length})
                                </h3>
                                <button
                                    onClick={() => setIsMembersCollapsed(!isMembersCollapsed)}
                                    className="text-gray-500 hover:text-gray-300"
                                    title={isMembersCollapsed ? "Expand" : "Collapse"}
                                >
                                    <ChevronDown
                                        size={16}
                                        className={` ${isMembersCollapsed ? "-rotate-90" : ""}`}
                                    />
                                </button>
                            </div>
                        )}

                        {/* When collapsed, maybe just show avatars in a stack or list? For now let's just show icons if not empty */}
                        {isCollapsed && roomMembers.length > 0 && (
                            <div className="border-t border-gray-800 pt-4 flex flex-col items-center gap-2">
                                {roomMembers.slice(0, 3).map(m => (
                                    <div key={m.id} className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 border border-gray-700/50" title={m.email}>
                                        <User size={16} />
                                    </div>
                                ))}
                                {roomMembers.length > 3 && (
                                    <span className="text-xs text-gray-500">+{roomMembers.length - 3}</span>
                                )}
                            </div>
                        )}

                        {!isCollapsed && !isMembersCollapsed && (
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
                                                className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-gray-800/30 group"
                                            >
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center border group-hover:border-gray-600 ${getUserColorClasses(member.id).bgSoft} ${getUserColorClasses(member.id).text} ${getUserColorClasses(member.id).border}`}>
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
            <div className={`p-4 border-t border-gray-800/50 ${isCollapsed ? 'flex justify-center' : ''}`}>
                {!isCollapsed ? (
                    <div className="text-xs text-gray-600 text-center">
                        DropVault v1.0
                    </div>
                ) : (
                    <div className="text-xs text-gray-600">v1.0</div>
                )}

            </div>
        </div>
    );
};

export default Sidebar;