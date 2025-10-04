import { useEffect, useState } from "react";
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

  const generateRandomCode = () => {
    const letters = Math.random().toString(36).substring(2, 6).toUpperCase();
    const digits = Math.floor(1000 + Math.random() * 9000);
    return `${letters}-${digits}`;
  };

  const initialFormState = {
    roomName: "",
    useCustomCode: false,
    customCode: "",
    randomCode: generateRandomCode(),
  };

  const [roomFormData, setRoomFormData] = useState(initialFormState);

  useEffect(() => {
    if (!roomFormData.useCustomCode) {
      setRoomFormData((prev) => ({
        ...prev,
        randomCode: generateRandomCode(),
      }));
    }
  }, [roomFormData.useCustomCode]);

  const handleChange = (field: string, value: string | boolean) => {
    setRoomFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!user) {
      alert("You must be logged in to create a room.");
      return;
    }

    const code = roomFormData.useCustomCode
      ? roomFormData.customCode.trim()
      : roomFormData.randomCode;

    if (!roomFormData.roomName || (roomFormData.useCustomCode && !roomFormData.customCode)) {
      alert("Please fill all required fields.");
      return;
    }

    setLoading(true);

    onCreate({
      name: roomFormData.roomName,
      code,
    });

    setLoading(false);
    setRoomFormData(initialFormState); // Clear form after creation
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-4 text-gray-500 hover:text-gray-700 text-xl"
        >
          &times;
        </button>
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Create a Room</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Room Name</label>
            <input
              type="text"
              value={roomFormData.roomName}
              onChange={(e) => handleChange("roomName", e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500"
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={roomFormData.useCustomCode}
              onChange={() => handleChange("useCustomCode", !roomFormData.useCustomCode)}
              id="useCustomCode"
            />
            <label htmlFor="useCustomCode" className="text-sm text-gray-700">
              Use custom room code
            </label>
          </div>

          {roomFormData.useCustomCode ? (
            <div>
              <label className="block text-sm font-medium text-gray-700">Custom Code</label>
              <input
                type="text"
                value={roomFormData.customCode}
                onChange={(e) => handleChange("customCode", e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500"
                maxLength={12}
              />
            </div>
          ) : (
            <div className="text-sm text-gray-600">
              <span className="font-medium text-gray-700">Generated Room Code:</span>{" "}
              <code className="bg-gray-100 px-2 py-1 rounded-md font-mono">
                {roomFormData.randomCode}
              </code>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md text-sm font-medium transition-all disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Room"}
          </button>
        </form>
      </div>
    </div>
  );
}
