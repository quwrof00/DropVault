
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase-client';
import { useAuthUser } from '../../hooks/useAuthUser';

interface Comment {
    id: string;
    content: string;
    created_at: string;
    user_id: string;
    user_email?: string; // Optional, might need to fetch or store
    room_id: string | null;
    item_type: string;
    item_id: string;
}

interface ItemDiscussionProps {
    itemId: string; // The filename or path
    itemType: 'note' | 'image' | 'file';
    roomId?: string | null;
}

export default function ItemDiscussion({ itemId, itemType, roomId }: ItemDiscussionProps) {
    const user = useAuthUser();
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // If we are not in a room, maybe we don't show discussion? 
    // Or we allow personal notes discussion (notes to self).
    // The user specifically asked for "in rooms", so we can assume roomId is present or handle both.

    useEffect(() => {
        if (!itemId || !user) return;

        // Load initial comments
        const fetchComments = async () => {
            setLoading(true);

            let query = supabase
                .from('item_comments')
                .select('*')
                .eq('item_id', itemId)
                .eq('item_type', itemType)
                .order('created_at', { ascending: true });

            if (roomId) {
                query = query.eq('room_id', roomId);
            } else {
                // For personal items, we check where room_id is null and user_id matches owner?
                // Actually, let's just stick to "room_id" matching. 
                // If it's a personal item, roomId is undefined/null.
                // But we need to make sure we don't mix personal comments.
                // For now, let's assume we filter by room_id if provided, 
                // or filter by user_id if it's personal? 
                // Simplest: `is('room_id', roomId ? roomId : null)`
                query = query.is('room_id', roomId ? roomId : null);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching comments:', error);
            } else {
                setComments(data || []);
            }
            setLoading(false);
        };

        fetchComments();

        // Subscribe to changes
        // Use a broader filter to avoid issues with special characters in filenames (item_id)
        const filter = roomId ? `room_id=eq.${roomId}` : `user_id=eq.${user.id}`;

        const channel = supabase
            .channel(`discussion:${roomId || user.id}:${itemId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'item_comments',
                    filter: filter
                },
                (payload) => {
                    const newComment = payload.new as Comment;
                    // Strict verification in JS
                    // 1. Check item_id match
                    if (newComment.item_id !== itemId) return;

                    // 2. Check item_type match
                    if (newComment.item_type !== itemType) return;

                    // 3. Verify room scope matches
                    const matchesRoom = roomId ? newComment.room_id === roomId : newComment.room_id === null;
                    if (!matchesRoom) return;

                    setComments((prev) => {
                        // Deduplicate based on ID
                        if (prev.some(c => c.id === newComment.id)) return prev;
                        return [...prev, newComment];
                    });

                    // Scroll to bottom after state update
                    setTimeout(() => {
                        if (scrollRef.current) {
                            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                        }
                    }, 100);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [itemId, itemType, roomId, user]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [comments]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !user) return;

        const content = newComment.trim();
        setNewComment(''); // Optimistic clear

        // Post to Supabase
        const { data, error } = await supabase
            .from('item_comments')
            .insert({
                item_id: itemId,
                item_type: itemType,
                room_id: roomId || null,
                user_id: user.id,
                content: content,
                user_email: user.email // Store email for display if possible, or we join on fetch
            })
            .select()
            .single();

        if (error) {
            console.error('Error posting comment:', error);
            alert('Failed to post comment');
            setNewComment(content); // Revert
        } else if (data) {
            // Immediate update for sender (confirms data is saved)
            setComments((prev) => {
                // Prevent duplicate if subscription fired already
                if (prev.some(c => c.id === data.id)) return prev;
                return [...prev, data];
            });
        }
    };

    if (!user) return null;

    return (
        <div className="flex flex-col h-full bg-gray-900/50 rounded-xl overflow-hidden border border-gray-700/50 shadow-inner">
            <div className="px-4 py-3 bg-gray-800/80 backdrop-blur-sm border-b border-gray-700/50 flex justify-between items-center flex-shrink-0">
                <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1 9.06 9.06 0 01-1.5-.13A5.57 5.57 0 012 11.57V11a5.57 5.57 0 0110.13-1.5c.42.03.85.05 1.28.05.14 0 .28-.01.42-.02V9.5a5.57 5.57 0 01.17-.97z" />
                    </svg>
                    Discussion
                </h3>
                <span className="text-xs font-medium text-gray-500 bg-gray-900/50 px-2 py-1 rounded-full">{comments.length}</span>
            </div>

            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4"
            >
                {loading ? (
                    <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-600 border-t-blue-500"></div>
                    </div>
                ) : comments.length === 0 ? (
                    <p className="text-center text-sm text-gray-500 italic py-4">No comments yet. Start the discussion!</p>
                ) : (
                    comments.map((comment) => {
                        const isMe = comment.user_id === user.id;
                        return (
                            <div key={comment.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                <div className={`flex items-baseline space-x-2 max-w-[85%] ${isMe ? 'flex-row-reverse space-x-reverse' : ''}`}>
                                    <span className="text-xs text-gray-400">
                                        {comment.user_email?.split('@')[0] || 'User'}
                                    </span>
                                    <div
                                        className={`rounded-lg px-3 py-2 text-sm ${isMe
                                            ? 'bg-blue-600 text-white rounded-tr-none'
                                            : 'bg-gray-700 text-gray-200 rounded-tl-none'
                                            }`}
                                    >
                                        {comment.content}
                                    </div>
                                </div>
                                <span className="text-[10px] text-gray-600 mt-1 px-1">
                                    {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        );
                    })
                )}
            </div>

            <form onSubmit={handleSubmit} className="p-3 bg-gray-800/80 backdrop-blur-sm border-t border-gray-700/50 flex gap-2 flex-shrink-0">
                <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <button
                    type="submit"
                    disabled={!newComment.trim()}
                    className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    Send
                </button>
            </form>
        </div>
    );
}
