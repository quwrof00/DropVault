import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase-client";
import { useAuth } from "../context/AuthContext";

export type Room = {
    id: string;
    name: string;
    created_by: string;
};

export type RoomFormData = {
    name: string;
    code: string;
};

export function useRooms() {
    const { user } = useAuth();
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const fetchRooms = useCallback(async () => {
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

        const roomList: Room[] = data.flatMap((entry: any) => entry.rooms);
        setRooms(roomList);
        setLoading(false);
    }, [user]);

    useEffect(() => {
        fetchRooms();
    }, [fetchRooms]);

    const createRoom = async (data: RoomFormData) => {
        if (!user) return false;
        setError(null);
        try {
            if (!data.name?.trim() || !data.code?.trim()) {
                throw new Error("Room name and code are required.");
            }

            const { data: existingRoom } = await supabase
                .from("rooms")
                .select("code")
                .eq("code", data.code.trim())
                .maybeSingle();

            if (existingRoom) {
                throw new Error("A room with this code already exists. Please choose a different code.");
            }

            const { error: roomError, data: room } = await supabase
                .from("rooms")
                .insert([{
                    name: data.name.trim(),
                    code: data.code.trim(),
                    created_by: user.id,
                }])
                .select()
                .single();

            if (roomError || !room) throw new Error(roomError?.message || "Failed to create room");

            const { error: userAddError } = await supabase.from("room_users").insert({
                room_id: room.id,
                user_id: user.id,
            });

            if (userAddError) throw new Error("Room created but failed to add you to it.");

            setSuccess(`Room "${data.name}" created successfully!`);
            await fetchRooms();
            setTimeout(() => setSuccess(null), 3000);
            return true;
        } catch (err: any) {
            setError(err.message);
            return false;
        }
    };

    const joinRoom = async (code: string) => {
        if (!user) return false;
        setError(null);
        try {
            const trimmedCode = code.trim();
            const { data: matchingRoom, error } = await supabase
                .from("rooms")
                .select("id, code, name")
                .eq("code", trimmedCode)
                .maybeSingle();

            if (error) throw error;
            if (!matchingRoom) throw new Error("Room not found. Please check the code.");

            const { data: existing } = await supabase
                .from("room_users")
                .select("*")
                .eq("room_id", matchingRoom.id)
                .eq("user_id", user.id)
                .maybeSingle();

            if (existing) {
                setSuccess(`You're already a member of "${matchingRoom.name}"!`);
                setTimeout(() => setSuccess(null), 3000);
                return true;
            }

            const { error: joinError } = await supabase.from("room_users").insert({
                room_id: matchingRoom.id,
                user_id: user.id,
            });

            if (joinError) throw joinError;

            setSuccess(`Successfully joined "${matchingRoom.name}"!`);
            await fetchRooms();
            setTimeout(() => setSuccess(null), 2000);
            return true;
        } catch (err: any) {
            setError(err.message || "Failed to join room.");
            return false;
        }
    };

    const leaveRoom = async (roomId: string, shouldDelete: boolean) => {
        if (!user) return;

        try {
            if (shouldDelete) {
                const { error: usersError } = await supabase.from("room_users").delete().eq("room_id", roomId);
                if (usersError) throw usersError;

                const { error: roomDeleteError } = await supabase.from("rooms").delete().eq("id", roomId);
                if (roomDeleteError) throw roomDeleteError;
            } else {
                const { error } = await supabase.from("room_users").delete().eq("user_id", user.id).eq("room_id", roomId);
                if (error) throw error;
            }

            await fetchRooms();
            // toast handled by caller or global listener, but returning success could work.
            return true;
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to leave room.");
            return false;
        }
    }

    const renameRoom = async (roomId: string, newName: string) => {
        if (!user) return;

        try {
            const { data: roomData, error: fetchError } = await supabase.from("rooms").select("id").eq("id", roomId).eq("created_by", user.id).single();
            if (fetchError || !roomData) {
                throw new Error("You do not have access to rename the room.");
            }

            const { error: updateError } = await supabase.from("rooms").update({ name: newName }).eq("id", roomId);
            if (updateError) throw updateError;

            // Immediate local update
            setRooms(prev => prev.map(r => r.id === roomId ? { ...r, name: newName } : r));

            // Sync with backend
            await fetchRooms();
            return true;
        } catch (error) {
            console.error(error);
        }
    }

    return { rooms, loading, error, success, createRoom, joinRoom, leaveRoom, renameRoom, setError, setSuccess };
}
