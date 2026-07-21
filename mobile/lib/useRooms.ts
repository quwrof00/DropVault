import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

export type Room = {
    id: string;
    name: string;
    created_by: string;
    code?: string;
};

export type RoomFormData = {
    name: string;
    code: string;
};

export function useRooms() {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (!error && !success) return;

        const timeout = setTimeout(() => {
            setError(null);
            setSuccess(null);
        }, 5000);

        return () => clearTimeout(timeout);
    }, [error, success]);

    const fetchRooms = useCallback(async () => {
        setLoading(true);
        try {
            const { data: authData, error: authError } = await supabase.auth.getUser();
            if (authError) throw authError;

            const user = authData.user;
            if (!user) {
                setRooms([]);
                return;
            }

            const { data, error } = await supabase
                .from("room_users")
                .select("rooms(id, name, created_by, code), inserted_at")
                .eq("user_id", user.id)
                .order("inserted_at", { ascending: false });

            if (error) throw error;

            const rows = Array.isArray(data) ? data : [];
            const roomList: Room[] = rows.flatMap((entry: any) => {
                const roomValue = entry?.rooms;
                if (Array.isArray(roomValue)) {
                    return roomValue.filter(Boolean);
                }
                return roomValue ? [roomValue] : [];
            });

            setRooms(roomList);
            setError(null);
        } catch (err: any) {
            console.error("Error fetching rooms:", err);
            setRooms([]);
            setError(err?.message || "Failed to load rooms.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRooms();
    }, [fetchRooms]);

    const createRoom = async (data: RoomFormData) => {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData.user;
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
                throw new Error("A room with this code already exists.");
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
            return true;
        } catch (err: any) {
            setError(err.message);
            return false;
        }
    };

    const joinRoom = async (code: string) => {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData.user;
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
                return true;
            }

            const { error: joinError } = await supabase.from("room_users").insert({
                room_id: matchingRoom.id,
                user_id: user.id,
            });

            if (joinError) throw joinError;

            setSuccess(`Successfully joined "${matchingRoom.name}"!`);
            await fetchRooms();
            return true;
        } catch (err: any) {
            setError(err.message || "Failed to join room.");
            return false;
        }
    };

    const leaveRoom = async (roomId: string, shouldDelete: boolean) => {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData.user;
        if (!user) return false;

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
            return true;
        } catch (err: any) {
            setError(err.message || "Failed to leave room.");
            return false;
        }
    };

    const renameRoom = async (roomId: string, newName: string) => {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData.user;
        if (!user) return false;

        try {
            const { data: roomData, error: fetchError } = await supabase
                .from("rooms")
                .select("id")
                .eq("id", roomId)
                .eq("created_by", user.id)
                .single();

            if (fetchError || !roomData) {
                throw new Error("You do not have access to rename the room.");
            }

            const { error: updateError } = await supabase
                .from("rooms")
                .update({ name: newName.trim() })
                .eq("id", roomId);

            if (updateError) throw updateError;

            setRooms((prev) => prev.map((room) => room.id === roomId ? { ...room, name: newName.trim() } : room));
            await fetchRooms();
            return true;
        } catch (err: any) {
            setError(err.message || "Failed to rename room.");
            return false;
        }
    };

    return { rooms, loading, error, success, createRoom, joinRoom, leaveRoom, renameRoom, setError, setSuccess, fetchRooms };
}
