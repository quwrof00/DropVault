import { supabase } from "../../../lib/supabase-client";
import { encryptFile, decryptAndDownload } from "../../../lib/crypto/file-encryption";
import type { WrappedDEK } from "../../../lib/crypto/file-encryption";

const FILE_BUCKET = "user-files";

// ─── Path helpers ─────────────────────────────────────────────────────────────

export const getFilesFolderPath = (userId: string, roomId?: string | null) =>
  roomId ? `room-${roomId}` : userId;

/** Storage path for the ciphertext blob. Extension .enc makes intent clear. */
const cipherPath = (folderPath: string, id: string) =>
  `${folderPath}/${id}.enc`;

// ─── Legacy (pre-encryption) helpers ─────────────────────────────────────────
//
// Files uploaded before this PR don't have a file_metadata row.
// We still list them from Storage and serve them via public URL.

/** List all objects in the Storage folder (legacy path). */
export const listLegacyStorageFiles = async (folderPath: string) =>
  supabase.storage.from(FILE_BUCKET).list(folderPath);

/** Return the public URL for a legacy (unencrypted) file. */
export const getFilePublicUrl = (folderPath: string, fileName: string, lastModified?: number) => {
  const { data } = supabase.storage
    .from(FILE_BUCKET)
    .getPublicUrl(`${folderPath}/${fileName}`);
  return data.publicUrl + (lastModified ? `?v=${lastModified}` : "");
};

/** Delete a legacy (unencrypted) file directly from Storage. */
export const deleteLegacyStorageFile = async (
  folderPath: string,
  fileName: string
): Promise<{ error: Error | null }> => {
  const { error } = await supabase.storage
    .from(FILE_BUCKET)
    .remove([`${folderPath}/${fileName}`]);
  return { error };
};


// ─── Metadata helpers ─────────────────────────────────────────────────────────

export interface FileMetadataRow {
  id: string;
  storage_path: string;
  file_iv: string;
  encrypted_dek: string;
  dek_iv: string;
  original_name: string;
  original_mime: string;
  original_size: number;
  created_at: string;
}

/** Fetch all file_metadata rows for a user / room. */
export const listStoredFiles = async (
  userId: string,
  roomId?: string | null
) => {
  const query = supabase
    .from("file_metadata")
    .select("*")
    .eq("file_type", "file")
    .order("created_at", { ascending: false });

  if (roomId) {
    query.eq("room_id", roomId);
  } else {
    query.eq("user_id", userId).is("room_id", null);
  }

  return query;
};

/** Fetch a single metadata row by storage_path. */
export const getFileMetadata = async (storagePath: string) =>
  supabase
    .from("file_metadata")
    .select("*")
    .eq("storage_path", storagePath)
    .single<FileMetadataRow>();

// ─── Upload (encrypt-then-upload) ─────────────────────────────────────────────

export interface UploadEncryptedFileOptions {
  file: File;
  userId: string;
  roomId?: string | null;
  secretKey: string;
  /** Unique identifier (uuid) for this file upload. */
  id: string;
}

export async function uploadEncryptedFile({
  file,
  userId,
  roomId,
  secretKey,
  id,
}: UploadEncryptedFileOptions): Promise<{ error: Error | null }> {
  // 1. Encrypt in the browser — no plaintext bytes ever leave the device.
  const { cipherBlob, fileIv, wrappedDEK } = await encryptFile(file, secretKey);

  const folderPath = getFilesFolderPath(userId, roomId);
  const path = cipherPath(folderPath, id);

  // 2. Upload ciphertext to Supabase Storage.
  const { error: uploadError } = await supabase.storage
    .from(FILE_BUCKET)
    .upload(path, cipherBlob, {
      contentType: "application/octet-stream",
      upsert: false,
    });

  if (uploadError) return { error: uploadError };

  // 3. Store the encryption envelope in Postgres.
  const { error: metadataError } = await supabase.from("file_metadata").insert({
    id,
    user_id: userId,
    room_id: roomId ?? null,
    storage_path: path,
    file_iv: fileIv,
    encrypted_dek: wrappedDEK.encryptedDek,
    dek_iv: wrappedDEK.dekIv,
    original_name: file.name,
    original_mime: file.type || "application/octet-stream",
    original_size: file.size,
    file_type: "file",
  });

  if (metadataError) {
    // Orphan cleanup: remove the ciphertext blob so storage stays consistent.
    await supabase.storage.from(FILE_BUCKET).remove([path]).catch(() => {});
    return { error: metadataError };
  }

  return { error: null };
}

// ─── Download (decrypt-then-save) ─────────────────────────────────────────────

export async function downloadAndDecryptFile(
  row: FileMetadataRow,
  secretKey: string
): Promise<{ error: Error | null }> {
  const { data: blob, error: dlError } = await supabase.storage
    .from(FILE_BUCKET)
    .download(row.storage_path);

  if (dlError || !blob) return { error: dlError ?? new Error("Empty download") };

  const wrapped: WrappedDEK = {
    encryptedDek: row.encrypted_dek,
    dekIv: row.dek_iv,
  };

  try {
    await decryptAndDownload(
      blob,
      wrapped,
      row.file_iv,
      row.original_name,
      row.original_mime,
      secretKey
    );
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err : new Error(String(err)) };
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteStoredFile(
  storagePath: string
): Promise<{ error: Error | null }> {
  const { error: storageError } = await supabase.storage
    .from(FILE_BUCKET)
    .remove([storagePath]);

  if (storageError) return { error: storageError };

  const { error: metaError } = await supabase
    .from("file_metadata")
    .delete()
    .eq("storage_path", storagePath);

  return { error: metaError };
}

// ─── Rename (metadata-only update) ───────────────────────────────────────────
//
// The ciphertext in Storage does not change — only the displayed name changes.

export async function renameStoredFile(
  storagePath: string,
  newName: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("file_metadata")
    .update({ original_name: newName })
    .eq("storage_path", storagePath);
  return { error };
}
