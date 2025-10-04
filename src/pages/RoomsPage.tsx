import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase-client";
import { useAuthUser } from "../hooks/useAuthUser";
import { useNavigate } from "react-router-dom";
import { toast } from 'react-toastify';
import { CreateRoomForm } from "../components/Room/CreateRoomForm";
import { CreateRoomButton } from "../components/Room/CreateRoomButton";
import { JoinRoomButton } from "../components/Room/JoinRoomButton";

type Room = {
  id: string;
  name: string;
  created_by: string;
};

type RoomFormData = {
  name: string;
  code: string;
};

export default function RoomsPage() {
  const navigate = useNavigate();
  const user = useAuthUser();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [createRoom, setCreateRoom] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchRooms = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("room_users")
      .select("rooms(id, name, created_by), inserted_at")
      .eq("user_id", user.id)
      .order("inserted_at", { ascending: false });

    if (error) {
      console.error("Error fetching rooms:", error);
      setLoading(false);
      return;
    }

    const roomList: Room[] = data.flatMap((entry) => entry.rooms);
    setRooms(roomList);
    setLoading(false);
  };

  useEffect(() => {
    fetchRooms();
  }, [user]);

  async function handleRoomCreate(data: RoomFormData) {
    if (!user) {
      console.error("User not logged in");
      setError("You must be logged in to create a room.");
      return;
    }

    setIsCreatingRoom(true);
    setError(null);

    try {
      // Validate input data
      if (!data.name?.trim() || !data.code?.trim()) {
        setError("Room name and code are required.");
        return;
      }

      // Check if room code already exists
      const { data: existingRoom } = await supabase
        .from("rooms")
        .select("code")
        .eq("code", data.code.trim())
        .maybeSingle();

      if (existingRoom) {
        setError("A room with this code already exists. Please choose a different code.");
        return;
      }

      const { error: roomError, data: room } = await supabase
        .from("rooms")
        .insert([
          {
            name: data.name.trim(),
            code: data.code.trim(),
            created_by: user.id,
          },
        ])
        .select()
        .single();

      if (roomError || !room) {
        console.error("Error creating room:", roomError?.message);
        setError(`Failed to create room: ${roomError?.message || "Unknown error"}`);
        return;
      }

      const { error: userAddError } = await supabase.from("room_users").insert({
        room_id: room.id,
        user_id: user.id,
      });

      if (userAddError) {
        console.error("Error adding user to room:", userAddError.message);
        setError("Room created but failed to add you to it. Please try joining manually.");
        return;
      }

      console.log("Room created and user added:", room);
      setSuccess(`Room "${data.name}" created successfully!`);
      setCreateRoom(false);
      await fetchRooms(); // Refresh room list
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Unexpected error creating room:", err);
      setError("An unexpected error occurred while creating the room.");
    } finally {
      setIsCreatingRoom(false);
    }
  }

  async function handleJoinRoom() {
    if (!user) {
      setError("You must be logged in to join a room.");
      return;
    }

    const code = prompt("Enter room code (case-sensitive):");
    if (!code?.trim()) return;

    const trimmedCode = code.trim();
    setIsJoiningRoom(true);
    setError(null);

    try {
      console.log("Entered code:", JSON.stringify(trimmedCode));
      console.log(
        "Entered code char codes:",
        Array.from(trimmedCode).map((c: string) => c.charCodeAt(0))
      );

      // Fetch a single room by code (case-sensitive)
      const { data: matchingRoom, error } = await supabase
        .from("rooms")
        .select("id, code, name")
        .eq("code", trimmedCode)
        .maybeSingle();

      if (error) {
        console.error("Error finding room:", error.message);
        setError("Error searching for room. Please try again.");
        return;
      }

      if (!matchingRoom) {
        setError("Room not found. Please check the code and try again (case-sensitive).");
        return;
      }

      console.log(
        `Found room: ID=${matchingRoom.id}, Code="${matchingRoom.code}", Name="${matchingRoom.name}"`
      );

      // Check if user already in the room
      const { data: existing, error: existingError } = await supabase
        .from("room_users")
        .select("*")
        .eq("room_id", matchingRoom.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingError) {
        console.error("Error checking room membership:", existingError.message);
        setError("Error checking room membership. Please try again.");
        return;
      }

      if (existing) {
        setSuccess(`You're already a member of "${matchingRoom.name}"!`);
        setTimeout(() => setSuccess(null), 3000);
        return;
      }

      const { error: joinError } = await supabase.from("room_users").insert({
        room_id: matchingRoom.id,
        user_id: user.id,
      });

      if (joinError) {
        console.error("Error joining room:", joinError.message);
        setError("Could not join room. Please try again.");
        return;
      }

      setSuccess(`Successfully joined "${matchingRoom.name}"!`);
      await fetchRooms(); // Refresh room list
      setTimeout(() => {
        setSuccess(null);
      }, 2000);
    } catch (err) {
      console.error("Unexpected error joining room:", err);
      setError("An unexpected error occurred while joining the room.");
    } finally {
      setIsJoiningRoom(false);
    }
  }

  const handleLeaveRoom = async (roomId: string, roomName: string) => {
    if (!user) return;

    const confirmLeave = window.confirm(
      `Are you sure you want to leave the room "${roomName}"?`
    );
    if (!confirmLeave) return;

    try {
      // Check if user is the creator of the room
      const { data: roomData, error: roomError } = await supabase
        .from("rooms")
        .select("created_by")
        .eq("id", roomId)
        .single();

      if (roomError || !roomData) {
        console.error("Error checking room creator:", roomError);
        window.alert("Could not verify room creator.");
        return;
      }

      if (roomData.created_by === user.id) {
        // Creator leaving → must delete room
        const confirmDelete = window.confirm(
          `You are the creator of "${roomName}". Leaving will delete the room for all users. Proceed?`
        );
        if (!confirmDelete) return;

        // 1. Delete room_users first
        const { error: usersError } = await supabase
          .from("room_users")
          .delete()
          .eq("room_id", roomId);

        if (usersError) {
          console.error("Error deleting room_users:", usersError);
          window.alert(`Failed to delete room users: ${usersError.message}`);
          return;
        }

        // 2. Delete the room itself
        const { error: roomDeleteError } = await supabase
          .from("rooms")
          .delete()
          .eq("id", roomId);

        if (roomDeleteError) {
          console.error("Error deleting room:", roomDeleteError);
          window.alert(`Failed to delete room: ${roomDeleteError.message}`);
          return;
        }
      } else {
        // Non-creator → just remove user from room_users
        const { error } = await supabase
          .from("room_users")
          .delete()
          .eq("user_id", user.id)
          .eq("room_id", roomId);

        if (error) {
          console.error("Error leaving room:", error);
          window.alert(`Failed to leave room: ${error.message}`);
          return;
        }
      }

      // Refresh list after success
      await fetchRooms();
      toast.success(`You have left "${roomName}".`);
    } catch (err: any) {
      console.error("Unexpected error leaving room:", err);
      window.alert(`Unexpected error: ${err.message ?? "Check console for details"}`);
    }
  };

  // Auto-clear error messages after 5 seconds
  useEffect(() => {
    if (error) {
      const timeout = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timeout);
    }
  }, [error]);

  return (
    <div className="flex-1 min-h-[calc(100vh-4rem)] bg-gray-700 p-4 sm:p-6 lg:p-8">
      {/* Success/Error Messages */}
      {(success || error) && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
          {success && (
            <div className="bg-emerald-600/90 backdrop-blur-xl text-white px-6 py-4 rounded-2xl shadow-2xl border border-emerald-400/20 flex items-center space-x-3">
              <div className="w-6 h-6 bg-emerald-400 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-900" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="font-medium">{success}</span>
              <button 
                onClick={() => setSuccess(null)}
                className="ml-2 text-emerald-200 hover:text-white transition-colors p-1"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}
          {error && (
            <div className="bg-rose-600/90 backdrop-blur-xl text-white px-6 py-4 rounded-2xl shadow-2xl border border-rose-400/20 flex items-center space-x-3">
              <div className="w-6 h-6 bg-rose-400 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-rose-900" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="font-medium">{error}</span>
              <button 
                onClick={() => setError(null)}
                className="ml-2 text-rose-200 hover:text-white transition-colors p-1"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-100 tracking-tight">
            Your Rooms
          </h1>
          {user && (
            <div className="flex items-center space-x-3">
              <CreateRoomButton 
                onClick={() => setCreateRoom(true)}
                isCreating={isCreatingRoom}
              />
              <JoinRoomButton 
                onClick={handleJoinRoom}
                isJoining={isJoiningRoom}
              />
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-200"></div>
          </div>
        ) : rooms.length === 0 ? (
          <p className="text-gray-400 text-lg italic text-center py-16">
            You’re not part of any rooms yet. Join or create one to get started!
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="bg-gray-800 rounded-xl shadow-lg hover:shadow-xl hover:bg-gray-600 transform hover:-translate-y-1 transition-all duration-300"
              >
                <div className="p-6 flex justify-between items-center">
                  <h2
                    className="text-xl font-semibold text-gray-100 truncate cursor-pointer"
                    onClick={() => navigate(`/room?roomId=${room.id}`)}
                  >
                    {room.name}
                  </h2>
                  <button
                    onClick={() => handleLeaveRoom(room.id, room.name)}
                    className="text-sm text-gray-400 hover:text-red-400 px-2 py-1 rounded-md hover:bg-gray-700 transition-colors duration-200"
                  >
                    Leave
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {createRoom && (
        <CreateRoomForm
          onClose={() => setCreateRoom(false)}
          onCreate={handleRoomCreate}
          isCreating={isCreatingRoom}
        />
      )}
    </div>
  );
}