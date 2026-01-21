import { useState } from "react";
import { useAuthUser } from "../../hooks/useAuthUser";

export type RoomFormData = {
  name: string;
  code: string;
};

type Props = {
  onClose: () => void;
  onCreate: (data: RoomFormData) => void;
  isCreating: boolean
};

export function CreateRoomForm({ onClose, onCreate }: Props) {
  const user = useAuthUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateRandomCode = () => {
    const letters = Math.random().toString(36).substring(2, 6).toUpperCase();
    const digits = Math.floor(1000 + Math.random() * 9000);
    return `${letters}-${digits}`;
  };

  const [roomFormData, setRoomFormData] = useState({
    roomName: "",
    randomCode: generateRandomCode(),
  });

  const handleChange = (field: string, value: string) => {
    setRoomFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setError(null);
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!user) {
      setError("You must be logged in to create a room.");
      return;
    }

    if (!roomFormData.roomName) {
      setError("Please enter a room name.");
      return;
    }

    setLoading(true);

    onCreate({
      name: roomFormData.roomName,
      code: roomFormData.randomCode,
    });

    setLoading(false);
    setRoomFormData({
      roomName: "",
      randomCode: generateRandomCode(),
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 p-6 rounded-xl shadow-2xl w-full max-w-md relative animate-scale-in">
        <button
          onClick={onClose}
          className="absolute top-3 right-4 text-gray-400 hover:text-white transition-colors text-xl"
        >
          &times;
        </button>
        <h2 className="text-xl font-semibold mb-4 text-gray-100">Create a Room</h2>

        {error && (
          <div className="mb-4 bg-red-900/50 border border-red-700 text-red-200 px-4 py-2 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300">Room Name</label>
            <input
              type="text"
              value={roomFormData.roomName}
              onChange={(e) => handleChange("roomName", e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              required
              placeholder="My Room"
            />
          </div>

          <div className="text-sm text-gray-400 bg-gray-900/50 p-3 rounded-lg border border-gray-700">
            <span className="font-medium text-gray-300">Room Code:</span>{" "}
            <code className="bg-gray-800 px-2 py-1 rounded text-blue-300 font-mono text-base ml-2">
              {roomFormData.randomCode}
            </code>
            <p className="mt-1 text-xs text-gray-500">Share this code with others to let them join.</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Creating...
              </>
            ) : "Create Room"}
          </button>
        </form>
      </div>
    </div>
  );
}
