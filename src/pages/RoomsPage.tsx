import { useState, useEffect } from "react";
import { useAuthUser } from "../hooks/useAuthUser";
import { CreateRoomForm } from "../components/Room/CreateRoomForm";
import { CreateRoomButton } from "../components/Room/CreateRoomButton";
import { JoinRoomButton } from "../components/Room/JoinRoomButton";
import { RoomCard } from "../components/Room/RoomCard";
import { useRooms } from "../hooks/useRooms";
import type { RoomFormData } from "../hooks/useRooms";
import { Dialog, type DialogProps } from "../components/UI/Dialog";

export default function RoomsPage() {
  const user = useAuthUser();
  const { rooms, loading, error, success, createRoom, joinRoom, leaveRoom, setError, setSuccess } = useRooms();

  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);

  const [dialog, setDialog] = useState<Partial<DialogProps> & { isOpen: boolean }>({ isOpen: false, title: "" });

  useEffect(() => {
    if (error) {
      const timeout = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timeout);
    }
  }, [error, setError]);

  // Dialog helpers
  const closeDialog = () => setDialog(prev => ({ ...prev, isOpen: false }));

  async function handleRoomCreate(data: RoomFormData) {
    if (!user) return;
    setIsCreatingRoom(true);
    const ok = await createRoom(data);
    setIsCreatingRoom(false);
    if (ok) setCreateRoomOpen(false);
  }

  function handleJoinRoom() {
    if (!user) return;
    setDialog({
      isOpen: true,
      title: "Join Room",
      message: "Enter room code (case-sensitive):",
      type: "input",
      placeholder: "Room Code",
      confirmText: "Join",
      onConfirm: async (code) => {
        if (!code?.trim()) return;
        setIsJoiningRoom(true);
        // We close dialog immediately or after? 
        // Logic says close dialog, then show loading logic.
        // But joinRoom sets state.
        closeDialog();
        await joinRoom(code);
        setIsJoiningRoom(false);
      }
    });
  }

  function handleLeaveRoom(roomId: string, roomName: string) {
    if (!user) return;
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;

    // Check creator
    const isCreator = room.created_by === user.id;

    if (isCreator) {
      setDialog({
        isOpen: true,
        title: "Delete Room?",
        message: `You are the creator of "${roomName}". Leaving will delete the room for all users. Proceed?`,
        type: "confirm",
        confirmText: "Delete Room",
        variant: "danger",
        onConfirm: async () => {
          closeDialog();
          const ok = await leaveRoom(roomId, true);
          if (ok) setSuccess(`Left and deleted "${roomName}"`);
        }
      });
    } else {
      setDialog({
        isOpen: true,
        title: "Leave Room",
        message: `Are you sure you want to leave the room "${roomName}"?`,
        type: "confirm",
        confirmText: "Leave",
        variant: "danger",
        onConfirm: async () => {
          closeDialog();
          const ok = await leaveRoom(roomId, false);
          if (ok) setSuccess(`Left "${roomName}"`);
        }
      });
    }
  }

  return (
    <div className="flex-1 min-h-[calc(100vh-4rem)] bg-gray-900 p-4 sm:p-6 lg:p-8">
      {/* Helper Dialog */}
      <Dialog
        onClose={closeDialog}
        {...dialog}
        isOpen={dialog.isOpen}
        title={dialog.title || ""}
      />

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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 sm:gap-0">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-100 tracking-tight">
            Your Rooms
          </h1>
          {user && (
            <div className="flex items-center space-x-3">
              <CreateRoomButton
                onClick={() => setCreateRoomOpen(true)}
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
              <RoomCard
                key={room.id}
                room={room}
                onLeave={handleLeaveRoom}
              />
            ))}
          </div>
        )}
      </div>

      {createRoomOpen && (
        <CreateRoomForm
          onClose={() => setCreateRoomOpen(false)}
          onCreate={handleRoomCreate}
          isCreating={isCreatingRoom}
        />
      )}
    </div>
  );
}
