"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthUser } from "../../hooks/useAuthUser";
import { useItemCounts } from "../../hooks/useItemCounts";
import { useIntersectionObserver } from "../../hooks/useIntersectionObserver";
import { logActivity } from "../../lib/activity";
import {
  getBaseName,
  getImagePrefixes,
  getSafeUniqueName,
  isImageFile,
  isValidBaseName,
  makeImagePublicUrl,
  type ImageFileEntry as FileEntry,
} from "./Images/helpers";
import {
  deleteImagePaths,
  deleteStoredImage,
  fetchAndDecryptFullImage,
  fetchAndDecryptImageThumbnail,
  listImageFiles,
  listStoredImages,
  moveImagePath,
  renameStoredImage,
  uploadEncryptedImage,
} from "./Images/actions";
import ImagesView from "./Images/ImagesView";

type ImagesProps = {
  roomId?: string | null;
};

export default function Images({ roomId }: ImagesProps) {
  const user = useAuthUser();
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<Record<string, FileEntry>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<any>({ isOpen: false, title: "" });
  const [visibleCount, setVisibleCount] = useState(24);
  const [isRenaming, setIsRenaming] = useState(false);
  const { targetRef, isIntersecting } = useIntersectionObserver({ rootMargin: "200px" });
  const itemCounts = useItemCounts(roomId, "image");
  const prefixes = useMemo(() => getImagePrefixes(user?.id, roomId), [user?.id, roomId]);

  // secretKey mirrors Notes / Files pattern: roomId takes priority in rooms
  const secretKey = roomId ?? user?.id ?? "";

  // In-memory decrypted URL caches to avoid re-decrypting on scroll/re-render
  const thumbnailCache = useRef<Map<string, string>>(new Map());
  const fullImageCache = useRef<Map<string, string>>(new Map());
  const pendingThumbnails = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (isIntersecting) setVisibleCount((prev) => prev + 24);
  }, [isIntersecting]);

  useEffect(() => {
    setVisibleCount(24);
  }, [searchTerm]);

  const toggleSelect = (name: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const isSelected = (name: string) => selectedFiles.has(name);

  // ─── Query: load both encrypted file_metadata rows & legacy Storage files ───
  const { data: storageFiles, isLoading: isQueryLoading, error: queryError } = useQuery({
    queryKey: ["images", prefixes.primary, prefixes.legacy, user?.id, roomId],
    queryFn: async () => {
      const [{ data: metaRows, error: metaErr }, legacyFiles] = await Promise.all([
        user ? listStoredImages(user.id, roomId) : { data: null, error: null },
        listImageFiles(prefixes.primary, prefixes.legacy),
      ]);

      if (metaErr && (metaErr as any).message !== "The resource was not found") {
        console.error("Failed to list encrypted images", metaErr);
      }

      const merged: Record<string, FileEntry> = {};

      // 1. Encrypted images from file_metadata
      (metaRows ?? []).forEach((row) => {
        merged[row.original_name] = {
          name: row.original_name,
          blob: new Blob(),
          uploaded: true,
          lastModified: new Date(row.created_at).getTime(),
          progress: 100,
          pathPrefix: prefixes.primary,
          _meta: row,
          _isLegacy: false,
        };
      });

      // 2. Legacy pre-encryption images from Storage
      Object.entries(legacyFiles).forEach(([name, entry]) => {
        if (!merged[name]) {
          merged[name] = {
            ...entry,
            _isLegacy: true,
          };
        }
      });

      return merged;
    },
    enabled: !!user && !!prefixes.primary,
  });

  useEffect(() => {
    if (!storageFiles) return;
    setFiles((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (next[key].uploaded) delete next[key];
      });
      return { ...next, ...storageFiles };
    });
  }, [storageFiles]);

  useEffect(() => {
    setIsLoading(isQueryLoading);
  }, [isQueryLoading]);

  useEffect(() => {
    if (queryError) console.error("Failed to fetch images", queryError);
  }, [queryError]);

  // ─── Lazy decrypt thumbnails for encrypted images ───────────────────────────
  useEffect(() => {
    if (!secretKey) return;

    const toDecrypt = Object.values(files).filter(
      (f) => f._meta && !f.thumbnailUrl && !pendingThumbnails.current.has(f._meta.id)
    );

    if (toDecrypt.length === 0) return;

    toDecrypt.forEach(async (file) => {
      const meta = file._meta!;
      pendingThumbnails.current.add(meta.id);

      if (thumbnailCache.current.has(meta.id)) {
        const cachedUrl = thumbnailCache.current.get(meta.id)!;
        setFiles((prev) => {
          if (!prev[meta.original_name]) return prev;
          return {
            ...prev,
            [meta.original_name]: {
              ...prev[meta.original_name],
              thumbnailUrl: cachedUrl,
              previewUrl: prev[meta.original_name]?.previewUrl || cachedUrl,
            },
          };
        });
        pendingThumbnails.current.delete(meta.id);
        return;
      }

      try {
        const url = await fetchAndDecryptImageThumbnail(meta, secretKey);
        thumbnailCache.current.set(meta.id, url);
        setFiles((prev) => {
          if (!prev[meta.original_name]) return prev;
          return {
            ...prev,
            [meta.original_name]: {
              ...prev[meta.original_name],
              thumbnailUrl: url,
              previewUrl: prev[meta.original_name]?.previewUrl || url,
            },
          };
        });
      } catch (err) {
        console.error("Failed to decrypt thumbnail for", meta.original_name, err);
      } finally {
        pendingThumbnails.current.delete(meta.id);
      }
    });
  }, [files, secretKey]);

  useEffect(() => {
    return () => {
      // Clean up in-memory object URLs
      thumbnailCache.current.forEach((url) => URL.revokeObjectURL(url));
      fullImageCache.current.forEach((url) => URL.revokeObjectURL(url));
      thumbnailCache.current.clear();
      fullImageCache.current.clear();
    };
  }, []);

  const closeDialog = () => setDialog((prev: any) => ({ ...prev, isOpen: false }));

  // ─── Upload: zero-knowledge AES-GCM client encryption ───────────────────────
  const uploadToSupabase = async (file: File, displayName: string) => {
    if (!user || !secretKey) return;
    setUploadingFiles((prev) => new Set(prev).add(displayName));
    const id = crypto.randomUUID();

    try {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15 + 5;
        setFiles((prev) => {
          if (!prev[displayName]) return prev;
          return {
            ...prev,
            [displayName]: {
              ...prev[displayName],
              progress: Math.min(progress, 95),
            },
          };
        });
      }, 200);

      const { error: uploadError } = await uploadEncryptedImage({
        file,
        userId: user.id,
        roomId,
        secretKey,
        id,
      });

      clearInterval(interval);

      if (!uploadError) {
        logActivity(user.id, "upload_image", displayName);
        queryClient.invalidateQueries({ queryKey: ["images"] });

        // Retrieve the stored metadata row
        const { data: rows } = await listStoredImages(user.id, roomId);
        const newRow = rows?.find((r) => r.id === id);

        setFiles((prev) => {
          if (!prev[displayName]) return prev;
          return {
            ...prev,
            [displayName]: {
              ...prev[displayName],
              uploaded: true,
              progress: 100,
              _meta: newRow,
              _isLegacy: false,
            },
          };
        });
      } else {
        console.error("Upload error:", uploadError);
        alert(`Upload failed: ${uploadError.message}`);
        setFiles((prev) => {
          const next = { ...prev };
          delete next[displayName];
          return next;
        });
      }
    } catch (err) {
      console.error("Upload exception:", err);
      alert(`Failed to upload ${displayName}`);
      setFiles((prev) => {
        const next = { ...prev };
        delete next[displayName];
        return next;
      });
    } finally {
      setUploadingFiles((prev) => {
        const next = new Set(prev);
        next.delete(displayName);
        return next;
      });
    }
  };

  const processFiles = async (filesInput: FileList | File[]) => {
    if (!user) return;
    const validFiles: File[] = [];
    const errors: string[] = [];
    const fileList = Array.isArray(filesInput) ? filesInput : Array.from(filesInput);

    for (const file of fileList) {
      if (!isImageFile(file.name)) {
        errors.push(`"${file.name}" is not a valid image file`);
        continue;
      }
      if (file.size > 25 * 1024 * 1024) {
        errors.push(`"${file.name}" is too large (max 25MB)`);
        continue;
      }
      const safeName = getSafeUniqueName(file.name, files);
      validFiles.push(safeName === file.name ? file : new File([file], safeName, { type: file.type }));
    }

    if (errors.length > 0) alert(`Some files could not be uploaded:\n${errors.join("\n")}`);

    for (const file of validFiles) {
      const localPreview = URL.createObjectURL(file);
      const newEntry: FileEntry = {
        name: file.name,
        blob: file,
        uploaded: false,
        lastModified: file.lastModified,
        progress: 0,
        previewUrl: localPreview,
        thumbnailUrl: localPreview,
        pathPrefix: prefixes.primary,
        _isLegacy: false,
      };
      setFiles((prev) => ({ ...prev, [file.name]: newEntry }));
      await uploadToSupabase(file, file.name);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    await processFiles(fileList);
    e.currentTarget.value = "";
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const fileList = e.dataTransfer.files;
    if (!fileList || fileList.length === 0) return;
    await processFiles(fileList);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
  };

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) pastedFiles.push(file);
        }
      }
      if (pastedFiles.length > 0) {
        e.preventDefault();
        await processFiles(pastedFiles);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [files, user, roomId]);

  // ─── Fullscreen / Modal preview: decodes full resolution if encrypted ────────
  const handleSelectImage = async (file: FileEntry) => {
    if (file._isLegacy) {
      setSelectedImage(file.url || file.previewUrl || null);
      return;
    }

    if (!file._meta || !secretKey) {
      setSelectedImage(file.thumbnailUrl || file.previewUrl || null);
      return;
    }

    // Immediately open modal with thumbnail for instant response
    setSelectedImage(file.thumbnailUrl || file.previewUrl || null);

    const meta = file._meta;
    if (fullImageCache.current.has(meta.id)) {
      setSelectedImage(fullImageCache.current.get(meta.id)!);
      return;
    }

    try {
      const fullUrl = await fetchAndDecryptFullImage(meta, secretKey);
      fullImageCache.current.set(meta.id, fullUrl);
      setSelectedImage(fullUrl);
    } catch (err) {
      console.error("Failed to decrypt full image", err);
    }
  };

  // ─── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = (fileName: string) => {
    if (!user) return;
    const entry = files[fileName];
    if (!entry) return;

    setDialog({
      isOpen: true,
      title: "Delete Image",
      message: `Are you sure you want to delete "${fileName}"?`,
      type: "confirm",
      confirmText: "Delete",
      variant: "danger",
      onConfirm: async () => {
        let error: Error | null = null;
        if (entry._meta) {
          ({ error } = await deleteStoredImage(entry._meta));
        } else {
          const prefix = entry.pathPrefix || prefixes.primary;
          ({ error } = await deleteImagePaths([`${prefix}/${fileName}`, `${prefix}/thumb_${fileName}`]));
        }

        if (error) {
          alert(`Failed to delete image "${fileName}": ${error.message}`);
          closeDialog();
          return;
        }

        queryClient.invalidateQueries({ queryKey: ["images"] });
        logActivity(user.id, "delete_image", fileName);
        setFiles((prev) => {
          const updated = { ...prev };
          if (updated[fileName]?.previewUrl?.startsWith("blob:")) {
            URL.revokeObjectURL(updated[fileName].previewUrl!);
          }
          delete updated[fileName];
          return updated;
        });
        closeDialog();
      },
    });
  };

  const handleBulkDelete = () => {
    if (selectedFiles.size === 0) return;
    setDialog({
      isOpen: true,
      title: "Delete Selected Images",
      message: `Delete ${selectedFiles.size} image(s)? This cannot be undone.`,
      type: "confirm",
      confirmText: "Delete All",
      variant: "danger",
      onConfirm: async () => {
        const names = Array.from(selectedFiles);
        const legacyPaths: string[] = [];

        for (const name of names) {
          const entry = files[name];
          if (entry?._meta) {
            await deleteStoredImage(entry._meta);
          } else if (entry) {
            const prefix = entry.pathPrefix || prefixes.primary;
            legacyPaths.push(`${prefix}/${name}`, `${prefix}/thumb_${name}`);
          }
        }

        if (legacyPaths.length > 0) {
          await deleteImagePaths(legacyPaths);
        }

        queryClient.invalidateQueries({ queryKey: ["images"] });
        setFiles((prev) => {
          const next = { ...prev };
          names.forEach((name) => {
            if (next[name]?.previewUrl?.startsWith("blob:")) {
              URL.revokeObjectURL(next[name].previewUrl!);
            }
            delete next[name];
          });
          return next;
        });
        setSelectedFiles(new Set());
        closeDialog();
      },
    });
  };

  // ─── Rename ────────────────────────────────────────────────────────────────
  const handleRename = async (oldName: string, newNameInput: string) => {
    if (!user || isRenaming) return;
    if (!newNameInput || newNameInput === oldName) {
      setRenamingFile(null);
      setNewFileName("");
      return;
    }

    const oldExtIndex = oldName.lastIndexOf(".");
    const oldExt = oldExtIndex !== -1 ? oldName.slice(oldExtIndex) : "";
    const newExtIndex = newNameInput.lastIndexOf(".");
    const hasExtension = newExtIndex !== -1;
    const newName = (hasExtension ? newNameInput : newNameInput + oldExt).trim();

    if (files[newName]) {
      alert(`File with name ${newName} already exists!`);
      return;
    }
    if (!isImageFile(newName)) {
      alert("New file name must be a valid image file type.");
      return;
    }
    if (!isValidBaseName(getBaseName(newName))) {
      alert("Only letters, numbers, spaces, _ and - are allowed in the name.");
      return;
    }

    setIsRenaming(true);
    try {
      const oldEntry = files[oldName];
      if (oldEntry?._meta) {
        const { error: renameErr } = await renameStoredImage(oldEntry._meta.id, newName);
        if (renameErr) {
          console.error("Rename error:", renameErr);
          alert("Failed to rename image");
          return;
        }
        setFiles((prev) => {
          const updated = { ...prev };
          const entry = updated[oldName];
          delete updated[oldName];
          updated[newName] = {
            ...entry,
            name: newName,
            _meta: entry._meta ? { ...entry._meta, original_name: newName } : undefined,
          };
          return updated;
        });
      } else {
        const prefix = oldEntry?.pathPrefix || prefixes.primary;
        const oldPath = `${prefix}/${oldName}`;
        const newPath = `${prefix}/${newName}`;
        const { error: moveError } = await moveImagePath(oldPath, newPath);
        if (moveError) {
          console.error("Move error:", moveError);
          alert("Failed to rename file");
          return;
        }
        if (oldEntry?.thumbnailUrl) {
          await moveImagePath(`${prefix}/thumb_${oldName}`, `${prefix}/thumb_${newName}`).catch(() => {});
        }
        queryClient.invalidateQueries({ queryKey: ["images"] });
        const publicUrl = makeImagePublicUrl(prefix, newName);
        setFiles((prev) => {
          const updated = { ...prev };
          const entry = updated[oldName];
          delete updated[oldName];
          updated[newName] = {
            ...(entry ?? { name: newName, blob: new Blob(), uploaded: true, lastModified: Date.now(), progress: 100, pathPrefix: prefix }),
            name: newName,
            previewUrl: publicUrl,
            url: publicUrl,
            thumbnailUrl: entry?.thumbnailUrl?.replace(oldName, newName),
            pathPrefix: prefix,
            _isLegacy: true,
          };
          return updated;
        });
      }
      setRenamingFile(null);
      setNewFileName("");
    } finally {
      setIsRenaming(false);
    }
  };

  if (user === undefined) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-800">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-600 border-t-blue-500" />
          <p className="text-gray-300 text-lg font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  const filteredFiles = Object.entries(files)
    .filter(([name]) => isImageFile(name))
    .filter(([name]) => name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort(([, a], [, b]) => b.lastModified - a.lastModified);

  return (
    <ImagesView
      roomId={roomId}
      dragOver={dragOver}
      isLoading={isLoading}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      selectedImage={selectedImage}
      setSelectedImage={setSelectedImage}
      selectedFiles={selectedFiles}
      setSelectedFiles={setSelectedFiles}
      filteredFiles={filteredFiles}
      visibleCount={visibleCount}
      targetRef={targetRef as any}
      files={files}
      itemCounts={itemCounts}
      uploadingFiles={uploadingFiles}
      renamingFile={renamingFile}
      newFileName={newFileName}
      setNewFileName={setNewFileName}
      setRenamingFile={setRenamingFile}
      isRenaming={isRenaming}
      dialog={dialog}
      closeDialog={closeDialog}
      toggleSelect={toggleSelect}
      isSelected={isSelected}
      onFileChange={handleFileChange}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDelete={handleDelete}
      onBulkDelete={handleBulkDelete}
      onRename={handleRename}
      onSelectImage={handleSelectImage}
    />
  );
}
