import { supabase } from "../../../lib/supabase-client";

export interface NotesUser {
  id: string;
}

export interface NoteRow {
  title: string;
  ciphertext: string | null;
  iv: string | null;
  salt: string | null;
  updated_at: string | null;
  is_collaborative?: boolean | null;
  user_id?: string | null;
}

export const getNoteId = (userId: string | undefined | null, title: string) => `${userId || "private"}:${title}`;

export const parseNoteId = (id: string) => {
  const i = id.indexOf(":");
  if (i === -1) return { userId: "private", title: id };
  return { userId: id.slice(0, i), title: id.slice(i + 1) };
};

export const buildNotesList = (files: Record<string, string>) =>
  Object.keys(files).map((id) => ({ id, path: parseNoteId(id).title }));

export const fetchUserEmailMap = async (notes: NoteRow[]) => {
  const userIds = [...new Set(notes.map((note) => note.user_id).filter(Boolean))] as string[];
  if (userIds.length === 0) return {};

  const { data, error } = await supabase.from("users").select("id, email").in("id", userIds);
  if (error) throw error;

  const emailMap: Record<string, string> = {};
  data?.forEach((user) => {
    emailMap[user.id] = user.email;
  });
  return emailMap;
};
