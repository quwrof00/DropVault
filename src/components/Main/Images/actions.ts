import { supabase } from "../../../lib/supabase-client";
import {
  IMAGE_BUCKET,
  INCLUDE_LEGACY_LISTING,
  isImageFile,
  makeImagePublicUrl,
  type ImageFileEntry,
} from "./helpers";

export const listImageFiles = async (primaryPrefix: string, legacyPrefix: string) => {
  const mergedFiles: Record<string, ImageFileEntry> = {};

  const { data: primaryList, error: primaryErr } = await supabase.storage.from(IMAGE_BUCKET).list(primaryPrefix);
  if (primaryErr && primaryErr.message !== "The resource was not found") {
    console.error("Failed to list primary prefix", primaryErr);
  } else if (primaryList) {
    primaryList.forEach((file) => {
      const fileName = file.name;
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
  return fetch(`${apiUrl}/images/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
};
