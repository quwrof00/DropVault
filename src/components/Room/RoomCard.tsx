import { useNavigate } from "react-router-dom";
import { Pen } from "lucide-react";

type Room = {
    id: string;
    name: string;
    created_by: string;
};

interface RoomCardProps {
    room: Room;
    onLeave: (roomId: string, roomName: string) => void;
    onRename: (roomId: string) => void;
    isCreator: boolean;
}

export function RoomCard({ room, onLeave, onRename, isCreator }: RoomCardProps) {
    const navigate = useNavigate();

    return (
        <div
            className="bg-gray-800 rounded-xl shadow-lg hover:shadow-xl hover:bg-gray-600 transform hover:-translate-y-1 transition-all duration-300"
        >
            <div className="p-6 flex justify-between items-center">
                <h2
                    className="text-xl font-semibold text-gray-100 truncate cursor-pointer"
                    onClick={() => navigate(`/room?roomId=${room.id}`)}
                >
                    {room.name}
                </h2>
                <div className="flex gap-2">
                    {isCreator && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onRename(room.id);
                            }}

                        >
                            <Pen className="text-gray-400" />
                        </button>
                    )}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onLeave(room.id, room.name);
                        }}
                        className="text-sm text-gray-400 hover:text-red-400 px-2 py-1 rounded-md hover:bg-gray-700 transition-colors duration-200"
                    >
                        Leave
                    </button>
                </div>

            </div>
        </div>
    );
}
