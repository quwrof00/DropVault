import { supabase } from "../../../lib/supabase-client";
import {
  createClientThumbnail,
  decryptThumbnailWithDEK,
  decryptToObjectURL,
  encryptFile,
  encryptThumbnailWithDEK,
} from "../../../lib/crypto/file-encryption";
import {
  IMAGE_BUCKET,
  INCLUDE_LEGACY_LISTING,
  isImageFile,
  makeImagePublicUrl,
  type ImageFileEntry,
} from "./helpers";

export interface ImageMetadataRow {
  id: string;
  user_id: string;
  room_id: string | null;
  storage_path: string;
  file_iv: string;
  encrypted_dek: string;
  dek_iv: string;
  original_name: string;
  original_mime: string;
  original_size: number;
  file_type: "image";
  created_at: string;
}

// ─── Encrypted Image Actions ──────────────────────────────────────────────────

/** Fetch all encrypted image metadata rows for a user / room. */
export const listStoredImages = async (
  userId: string,
  roomId?: string | null
): Promise<{ data: ImageMetadataRow[] | null; error: Error | null }> => {
  let query = supabase
    .from("file_metadata")
    .select("*")
    .eq("file_type", "image")
    .order("created_at", { ascending: false });

  if (roomId) {
    query = query.eq("room_id", roomId);
  } else {
    query = query.is("room_id", null).eq("user_id", userId);
  }

  const { data, error } = await query;
  return { data: data as ImageMetadataRow[] | null, error };
};

/**
 * Upload an image with client-side zero-knowledge encryption:
 * 1. Generates a fresh AES-GCM DEK.
 * 2. Downscales an offscreen canvas thumbnail.
 * 3. Encrypts both full image and thumbnail with the DEK.
 * 4. Uploads ciphertext blobs to user-images bucket.
 * 5. Stores wrapped DEK + envelope in file_metadata.
 */
export const uploadEncryptedImage = async ({
  file,
  userId,
  roomId,
  secretKey,
  id,
}: {
  file: File;
  userId: string;
  roomId?: string | null;
  secretKey: string;
  id: string;
}): Promise<{ error: Error | null }> => {
  try {
    const prefix = roomId ? `room-${roomId}` : userId;
    const fullStoragePath = `${prefix}/${id}.enc`;
    const thumbStoragePath = `${prefix}/thumb_${id}.enc`;

    // 1. Generate client thumbnail
    const thumbBlob = await createClientThumbnail(file);

    // 2. Encrypt full image
    const { cipherBlob, fileIv, wrappedDEK, rawDek } = await encryptFile(file, secretKey);

    // 3. Encrypt thumbnail with the same DEK
    const cipherThumb = await encryptThumbnailWithDEK(thumbBlob, rawDek!);

    // 4. Upload full image ciphertext to user-images bucket
    const { error: fullUploadErr } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(fullStoragePath, cipherBlob, {
        contentType: "application/octet-stream",
        upsert: false,
      });
    if (fullUploadErr) return { error: fullUploadErr };

    // 5. Upload thumbnail ciphertext to user-images bucket
    const { error: thumbUploadErr } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(thumbStoragePath, cipherThumb, {
        contentType: "application/octet-stream",
        upsert: false,
      });
    if (thumbUploadErr) {
      await supabase.storage.from(IMAGE_BUCKET).remove([fullStoragePath]);
      return { error: thumbUploadErr };
    }

    // 6. Insert metadata record into file_metadata
    const { error: metaErr } = await supabase.from("file_metadata").insert({
      id,
      user_id: userId,
      room_id: roomId || null,
      storage_path: fullStoragePath,
      file_iv: fileIv,
      encrypted_dek: wrappedDEK.encryptedDek,
      dek_iv: wrappedDEK.dekIv,
      original_name: file.name,
      original_mime: file.type || "image/jpeg",
      original_size: file.size,
      file_type: "image",
    });

    if (metaErr) {
      await supabase.storage.from(IMAGE_BUCKET).remove([fullStoragePath, thumbStoragePath]);
      return { error: metaErr };
    }

    return { error: null };
  } catch (err: any) {
    return { error: err instanceof Error ? err : new Error(String(err)) };
  }
};

/** Download and decrypt image thumbnail in the browser. */
export const fetchAndDecryptImageThumbnail = async (
  row: ImageMetadataRow,
  secretKey: string
): Promise<string> => {
  const prefix = row.storage_path.substring(0, row.storage_path.lastIndexOf("/"));
  const thumbPath = `${prefix}/thumb_${row.id}.enc`;

  // Try thumbnail first
  const { data: thumbBlob, error: thumbErr } = await supabase.storage
    .from(IMAGE_BUCKET)
    .download(thumbPath);

  if (!thumbErr && thumbBlob) {
    return decryptThumbnailWithDEK(
      thumbBlob,
      { encryptedDek: row.encrypted_dek, dekIv: row.dek_iv },
      secretKey
    );
  }

  // Fall back to full image if thumbnail not found
  const { data: fullBlob, error: fullErr } = await supabase.storage
    .from(IMAGE_BUCKET)
    .download(row.storage_path);

  if (fullErr || !fullBlob) {
    throw new Error(fullErr?.message || "Failed to download image");
  }

  return decryptToObjectURL(
    fullBlob,
    { encryptedDek: row.encrypted_dek, dekIv: row.dek_iv },
    row.file_iv,
    row.original_mime,
    secretKey
  );
};

/** Download and decrypt full resolution image in the browser. */
export const fetchAndDecryptFullImage = async (
  row: ImageMetadataRow,
  secretKey: string
): Promise<string> => {
  const { data: fullBlob, error: fullErr } = await supabase.storage
    .from(IMAGE_BUCKET)
    .download(row.storage_path);

  if (fullErr || !fullBlob) {
    throw new Error(fullErr?.message || "Failed to download full image");
  }

  return decryptToObjectURL(
    fullBlob,
    { encryptedDek: row.encrypted_dek, dekIv: row.dek_iv },
    row.file_iv,
    row.original_mime,
    secretKey
  );
};

/** Delete an encrypted image's storage blobs and its metadata row. */
export const deleteStoredImage = async (
  row: ImageMetadataRow
): Promise<{ error: Error | null }> => {
  const prefix = row.storage_path.substring(0, row.storage_path.lastIndexOf("/"));
  const thumbPath = `${prefix}/thumb_${row.id}.enc`;

  await supabase.storage.from(IMAGE_BUCKET).remove([row.storage_path, thumbPath]);
  const { error } = await supabase.from("file_metadata").delete().eq("id", row.id);
  return { error };
};

/** Rename an encrypted image by updating its original_name in metadata. */
export const renameStoredImage = async (
  id: string,
  newName: string
): Promise<{ error: Error | null }> => {
  const { error } = await supabase
    .from("file_metadata")
    .update({ original_name: newName })
    .eq("id", id);
  return { error };
};

// ─── Legacy (Pre-Encryption) Helpers ──────────────────────────────────────────

/** List pre-encryption images from Storage. Skips ciphertext .enc blobs. */
export const listImageFiles = async (primaryPrefix: string, legacyPrefix: string) => {
  const mergedFiles: Record<string, ImageFileEntry> = {};

  const { data: primaryList, error: primaryErr } = await supabase.storage.from(IMAGE_BUCKET).list(primaryPrefix);
  if (primaryErr && primaryErr.message !== "The resource was not found") {
    console.error("Failed to list primary prefix", primaryErr);
  } else if (primaryList) {
    primaryList.forEach((file) => {
      const fileName = file.name;
      // Skip encrypted files and their thumbnails
      if (fileName.endsWith(".enc")) return;

      if (isImageFile(fileName) && !fileName.startsWith("thumb_")) {
        const lastModified = new Date(file.updated_at || file.created_at || Date.now()).getTime();
        const publicUrl = makeImagePublicUrl(primaryPrefix, fileName) + `?v=${lastModified}`;
        const thumbName = `thumb_${fileName}`;
        const hasThumb = primaryList.some((entry) => entry.name === thumbName);
        mergedFiles[fileName] = {
          name: fileName,
          blob: new Blob(),
          uploaded: true,
          lastModified,
          progress: 100,
          url: publicUrl,
          previewUrl: publicUrl,
          thumbnailUrl: hasThumb ? makeImagePublicUrl(primaryPrefix, thumbName) + `?v=${lastModified}` : undefined,
          pathPrefix: primaryPrefix,
        };
      }
    });
  }

  if (INCLUDE_LEGACY_LISTING && legacyPrefix && legacyPrefix !== primaryPrefix) {
    const { data: legacyList, error: legacyErr } = await supabase.storage.from(IMAGE_BUCKET).list(legacyPrefix);
    if (legacyErr && legacyErr.message !== "The resource was not found") {
      console.error("Failed to list legacy prefix", legacyErr);
    } else if (legacyList) {
      legacyList.forEach((file) => {
        const fileName = file.name;
        // Skip encrypted files and their thumbnails
        if (fileName.endsWith(".enc")) return;

        if (isImageFile(fileName) && !fileName.startsWith("thumb_") && !mergedFiles[fileName]) {
          const lastModified = new Date(file.updated_at || file.created_at || Date.now()).getTime();
          const publicUrl = makeImagePublicUrl(legacyPrefix, fileName) + `?v=${lastModified}`;
          const thumbName = `thumb_${fileName}`;
          const hasThumb = legacyList.some((entry) => entry.name === thumbName);
          mergedFiles[fileName] = {
            name: fileName,
            blob: new Blob(),
            uploaded: true,
            lastModified,
            progress: 100,
            url: publicUrl,
            previewUrl: publicUrl,
            thumbnailUrl: hasThumb ? makeImagePublicUrl(legacyPrefix, thumbName) + `?v=${lastModified}` : undefined,
            pathPrefix: legacyPrefix,
          };
        }
      });
    }
  }

  return mergedFiles;
};

export const uploadImageFile = async (path: string, fileEntry: ImageFileEntry) =>
  supabase.storage.from(IMAGE_BUCKET).upload(path, fileEntry.blob, { upsert: true });

export const deleteImagePaths = async (paths: string[]) => supabase.storage.from(IMAGE_BUCKET).remove(paths);

export const moveImagePath = async (oldPath: string, newPath: string) =>
  supabase.storage.from(IMAGE_BUCKET).move(oldPath, newPath);

export const triggerImageProcessing = async (payload: {
  userId: string | null;
  roomId: string | null;
  fileName: string;
  fileType: string;
}) => {
  const apiUrl = import.meta.env.VITE_API_URL || "/api";
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(`${apiUrl}/images/process`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
};
