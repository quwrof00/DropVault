import { supabase } from "../../../lib/supabase-client";

export const applyNotesScopeFilter = (query: any, userId: string, roomId?: string | null) => {
  return roomId ? query.eq("room_id", roomId) : query.eq("user_id", userId).is("room_id", null);
};

export const fetchNotes = async (userId: string, roomId?: string | null) => {
  let query = supabase
    .from("notes")
    .select("title, ciphertext, iv, salt, updated_at, is_collaborative, user_id");

  query = applyNotesScopeFilter(query, userId, roomId);
  query = query.order("updated_at", { ascending: false });

  return await query;
};

export const saveNoteData = async (
  userId: string,
  roomId: string | null | undefined,
  noteData: { title: string; ciphertext: string; iv: string; salt: string; updated_at: string }
) => {
  return await supabase.from("notes").upsert(
    {
      ...noteData,
      user_id: userId,
      room_id: roomId ?? null,
    },
    {
      onConflict: roomId ? "user_id,room_id,title" : "user_id,title",
    }
  );
};

export const insertNoteData = async (
  userId: string,
  roomId: string | null | undefined,
  title: string,
  encrypted: { ciphertext: string; iv: string; salt: string },
  isCollaborative: boolean = false
) => {
  return await supabase.from("notes").insert({
    user_id: userId,
    room_id: roomId ?? null,
    title,
    ciphertext: encrypted.ciphertext,
    iv: encrypted.iv,
    salt: encrypted.salt,
    is_collaborative: isCollaborative,
  });
};

export const deleteNoteData = async (title: string, userId: string, roomId?: string | null) => {
  let query = supabase.from("notes").delete().eq("title", title);
  query = applyNotesScopeFilter(query, userId, roomId);
  return await query;
};

export const updateNoteTitle = async (oldTitle: string, newTitle: string, userId: string, roomId?: string | null) => {
  let query = supabase.from("notes").update({ title: newTitle }).eq("title", oldTitle);
  query = applyNotesScopeFilter(query, userId, roomId);
  return await query;
};
