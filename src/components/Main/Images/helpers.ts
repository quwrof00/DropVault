import { supabase } from "../../../lib/supabase-client";

export type ImageFileEntry = {
  name: string;
  blob: Blob;
  uploaded: boolean;
  lastModified: number;
  progress: number;
  url?: string;
  previewUrl?: string;
  thumbnailUrl?: string;
  pathPrefix: string;
};

export const IMAGE_BUCKET = "user-images";
export const USE_NAMESPACED_PATHS = true;
export const INCLUDE_LEGACY_LISTING = true;

export const isImageFile = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase();
  return !!ext && ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "tiff"].includes(ext);
};

export const getBaseName = (fileName: string) => fileName.replace(/\.[^/.]+$/, "");

export const isValidBaseName = (base: string) => /^[a-zA-Z0-9 _-]+$/.test(base);

export const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))}${sizes[i]}`;
};

export const sanitizeFileName = (name: string) => {
  const extIndex = name.lastIndexOf(".");
  const base = extIndex !== -1 ? name.slice(0, extIndex) : name;
  const ext = extIndex !== -1 ? name.slice(extIndex) : "";

  const sanitizedBase = base
    .replace(/[^a-zA-Z0-9 _-]/g, "_")
    .replace(/\s+/g, "")
    .replace(/_+/g, "_")
    .trim()
    .replace(/^_+|_+$/g, "");

  return `${sanitizedBase || "file"}${ext}`;
};

export const getSafeUniqueName = (
  originalName: string,
  existing: Record<string, unknown>,
) => {
  const sanitized = sanitizeFileName(originalName);

  if (!existing[sanitized]) return sanitized;

  const extIndex = sanitized.lastIndexOf(".");
  const base = extIndex !== -1 ? sanitized.slice(0, extIndex) : sanitized;
  const ext = extIndex !== -1 ? sanitized.slice(extIndex) : "";

  let i = 1;
  let newName = `${base} (${i})${ext}`;

  while (existing[newName]) {
    i++;
    newName = `${base} (${i})${ext}`;
  }

  return newName;
};

export const getImagePrefixes = (
  userId?: string | null,
  roomId?: string | null,
) => {
  if (!userId) return { primary: "", legacy: "" };

  if (USE_NAMESPACED_PATHS) {
    return {
      primary: roomId ? `room-${roomId}` : userId,
      legacy: roomId ? roomId : userId,
    };
  }

  const legacy = roomId ?? userId;
  return { primary: legacy, legacy };
};

export const makeImagePublicUrl = (pathPrefix: string, fileName: string) => {
  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(`${pathPrefix}/${fileName}`);
  return data.publicUrl;
};
