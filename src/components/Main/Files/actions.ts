import { supabase } from "../../../lib/supabase-client";
import type { StoredFileEntry } from "./helpers";

const FILE_BUCKET = "user-files";

export const getFilesFolderPath = (userId: string, roomId?: string | null) =>
  roomId ? `room-${roomId}` : userId;

export const listStoredFiles = async (folderPath: string) => {
  const { data, error } = await supabase.storage.from(FILE_BUCKET).list(folderPath);
  return { data, error };
};

export const getFilePublicUrl = (folderPath: string, fileName: string, lastModified?: number) => {
  const { data } = supabase.storage.from(FILE_BUCKET).getPublicUrl(`${folderPath}/${fileName}`);
  return data.publicUrl + (lastModified ? `?v=${lastModified}` : "");
};

export const uploadStoredFile = async (folderPath: string, fileEntry: StoredFileEntry) =>
  supabase.storage.from(FILE_BUCKET).upload(`${folderPath}/${fileEntry.name}`, fileEntry.blob, {
    upsert: true,
  });

export const deleteStoredFile = async (folderPath: string, fileName: string) =>
  supabase.storage.from(FILE_BUCKET).remove([`${folderPath}/${fileName}`]);

export const downloadStoredFile = async (folderPath: string, fileName: string) =>
  supabase.storage.from(FILE_BUCKET).download(`${folderPath}/${fileName}`);

export const renameStoredFile = async (folderPath: string, oldName: string, newName: string) => {
  const oldPath = `${folderPath}/${oldName}`;
  const newPath = `${folderPath}/${newName}`;

  const { data: downloadData, error: downloadError } = await downloadStoredFile(folderPath, oldName);
  if (downloadError || !downloadData) {
    return { error: downloadError ?? new Error("Missing download data") };
  }

  const { error: uploadError } = await supabase.storage
    .from(FILE_BUCKET)
    .upload(newPath, downloadData, { upsert: true });
  if (uploadError) {
    return { error: uploadError };
  }

  const { error: deleteError } = await supabase.storage.from(FILE_BUCKET).remove([oldPath]);
  return { error: deleteError };
};
