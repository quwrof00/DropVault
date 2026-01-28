
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase-client';
import { useAuthUser } from './useAuthUser';

export function useItemCounts(roomId: string | null | undefined, itemType?: string) {
    const [counts, setCounts] = useState<{ [itemId: string]: number }>({});
    const user = useAuthUser();

    useEffect(() => {
        if (user === undefined) return;

        // Initial fetch
        const fetchCounts = async () => {
            // If roomId is present, fetch counts for that room
            // If no roomId, fetch counts for user (personal items)

            // We can use a group by query if available, or just fetch all and count locally (might be heavy for millions, ok for thousands)
            // Supabase doesn't support "group by" easily in client lib without rpc.
            // We'll simplisticly list 'id, item_id' and count.

            let query = supabase
                .from('item_comments')
                .select('id, item_id, item_type, room_id, created_at');

            if (roomId) {
                query = query.eq('room_id', roomId);
            } else {
                query = query.is('room_id', null).eq('user_id', user?.id);
            }

            if (itemType) {
                query = query.eq('item_type', itemType);
            }

            const { data, error } = await query;

            if (!error && data) {
                const newCounts: { [itemId: string]: number } = {};
                data.forEach(comment => {
                    newCounts[comment.item_id] = (newCounts[comment.item_id] || 0) + 1;
                });
                setCounts(newCounts);
            }
        };

        fetchCounts();

        // Subscribe to changes
        // We listen to the whole table with filter

        const channel = supabase
            .channel(`counts:${roomId || user?.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // INSERT and DELETE
                    schema: 'public',
                    table: 'item_comments',
                    filter: roomId ? `room_id=eq.${roomId}` : undefined // Filter in callback for null room_id if complex
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newComment = payload.new as any;

                        // Double check filter for personal items (roomId is null)
                        const matchesRoom = roomId ? newComment.room_id === roomId : newComment.room_id === null;
                        if (!matchesRoom) return;

                        setCounts(prev => ({
                            ...prev,
                            [newComment.item_id]: (prev[newComment.item_id] || 0) + 1
                        }));
                    } else if (payload.eventType === 'DELETE') {
                        // Ideally we need item_id to decrement. DELETE payload only has ID unless replica identity is full.
                        // If replica identity is default, we might not get item_id. 
                        // We'll ignore DELETE decrement for now unless we know we have the data, 
                        // or we trigger a refetch. Refetch is safer.
                        fetchCounts();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [roomId, itemType, user]);

    return counts;
}
