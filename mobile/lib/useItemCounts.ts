import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export function useItemCounts(roomId?: string, itemType?: "note" | "file" | "image") {
    const [counts, setCounts] = useState<Record<string, number>>({});

    useEffect(() => {
        if (!roomId) {
            setCounts({});
            return;
        }

        const fetchCounts = async () => {
            let query = supabase
                .from("item_comments")
                .select("id, item_id, item_type, room_id")
                .eq("room_id", roomId);

            if (itemType) {
                query = query.eq("item_type", itemType);
            }

            const { data, error } = await query;
            if (error || !data) return;

            const nextCounts: Record<string, number> = {};
            data.forEach((comment) => {
                nextCounts[comment.item_id] = (nextCounts[comment.item_id] || 0) + 1;
            });
            setCounts(nextCounts);
        };

        fetchCounts();

        const channel = supabase
            .channel(`item-counts:${roomId}:${itemType ?? "all"}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "item_comments",
                },
                (payload) => {
                    if (payload.eventType === "INSERT") {
                        const newComment = payload.new as { item_id: string; item_type: string; room_id: string | null };
                        if (newComment.room_id !== roomId) return;
                        if (itemType && newComment.item_type !== itemType) return;

                        setCounts((prev) => ({
                            ...prev,
                            [newComment.item_id]: (prev[newComment.item_id] || 0) + 1,
                        }));
                        return;
                    }

                    fetchCounts();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [roomId, itemType]);

    return counts;
}
