"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
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
  listImageFiles,
  moveImagePath,
  triggerImageProcessing,
  uploadImageFile,
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

  const { data: storageFiles, isLoading: isQueryLoading, error: queryError } = useQuery({
    queryKey: ["images", prefixes.primary, prefixes.legacy],
    queryFn: async () => listImageFiles(prefixes.primary, prefixes.legacy),
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

  useEffect(() => {
    return () => {
      Object.values(files).forEach((file) => {
        if (file.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(file.previewUrl);
      });
    };
  }, [files]);

  const closeDialog = () => setDialog((prev: any) => ({ ...prev, isOpen: false }));

  const uploadToSupabase = async (fileEntry: FileEntry) => {
    if (!user) return;
    const path = roomId ? `room-${roomId}/${fileEntry.name}` : `${user.id}/${fileEntry.name}`;
    setUploadingFiles((prev) => new Set(prev).add(fileEntry.name));

    try {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15 + 5;
        setFiles((prev) => ({
          ...prev,
          [fileEntry.name]: {
            ...prev[fileEntry.name],
            progress: Math.min(progress, 95),
          },
        }));
      }, 200);

      const { error: uploadError } = await uploadImageFile(path, fileEntry);
      clearInterval(interval);

      if (!uploadError) {
        const pathPrefix = roomId ? `room-${roomId}` : `${user.id}`;
        const timestamp = Date.now();
        const publicUrl = makeImagePublicUrl(pathPrefix, fileEntry.name) + `?v=${timestamp}`;

        triggerImageProcessing({
          userId: roomId ? null : user.id,
          roomId: roomId || null,
          fileName: fileEntry.name,
          fileType: fileEntry.blob.type,
        }).catch((err) => console.error("Failed to trigger background process:", err));

        queryClient.invalidateQueries({ queryKey: ["images", prefixes.primary, prefixes.legacy] });

        setFiles((prev) => ({
          ...prev,
          [fileEntry.name]: {
            ...prev[fileEntry.name],
            uploaded: true,
            progress: 100,
            url: publicUrl,
            previewUrl: publicUrl,
            thumbnailUrl: makeImagePublicUrl(pathPrefix, `thumb_${fileEntry.name}`) + `?v=${timestamp}`,
          },
        }));

        logActivity(user.id, "upload_image", fileEntry.name);
      } else {
        console.error("Upload error:", uploadError);
        setFiles((prev) => ({
          ...prev,
          [fileEntry.name]: { ...prev[fileEntry.name], progress: 0 },
        }));
        const errorMsg = uploadError.message.includes("already exists")
          ? "A file with this name already exists"
          : uploadError.message;
        alert(`Upload failed: ${errorMsg}`);
      }
    } catch (err) {
      console.error("Upload exception:", err);
      alert(`Failed to upload ${fileEntry.name}`);
      setFiles((prev) => ({
        ...prev,
        [fileEntry.name]: { ...prev[fileEntry.name], progress: 0 },
      }));
    } finally {
      setUploadingFiles((prev) => {
        const next = new Set(prev);
        next.delete(fileEntry.name);
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
      if (file.size > 10 * 1024 * 1024) {
        errors.push(`"${file.name}" is too large (max 10MB)`);
        continue;
      }
      const safeName = getSafeUniqueName(file.name, files);
      validFiles.push(safeName === file.name ? file : new File([file], safeName, { type: file.type }));
    }

    if (errors.length > 0) alert(`Some files could not be uploaded:\n${errors.join("\n")}`);

    for (const file of validFiles) {
      const newEntry: FileEntry = {
        name: file.name,
        blob: file,
        uploaded: false,
        lastModified: file.lastModified,
        progress: 0,
        previewUrl: URL.createObjectURL(file),
        pathPrefix: prefixes.primary,
      };
      setFiles((prev) => ({ ...prev, [file.name]: newEntry }));
      await uploadToSupabase(newEntry);
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

  const handleDelete = (fileName: string) => {
    if (!user) return;
    setDialog({
      isOpen: true,
      title: "Delete Image",
      message: `Are you sure you want to delete "${fileName}"?`,
      type: "confirm",
      confirmText: "Delete",
      variant: "danger",
      onConfirm: async () => {
        const entry = files[fileName];
        const prefix = entry?.pathPrefix || prefixes.primary;
        const { error } = await deleteImagePaths([`${prefix}/${fileName}`, `${prefix}/thumb_${fileName}`]);
        if (error) {
          alert(`Failed to delete file "${fileName}": ${error.message}`);
          closeDialog();
          return;
        }
        queryClient.invalidateQueries({ queryKey: ["images", prefixes.primary, prefixes.legacy] });
        logActivity(user.id, "delete_image", fileName);
        setFiles((prev) => {
          const updated = { ...prev };
          if (updated[fileName]?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(updated[fileName].previewUrl!);
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
        const pathsToDelete = names.flatMap((name) => {
          const entry = files[name];
          const prefix = entry?.pathPrefix || prefixes.primary;
          return [`${prefix}/${name}`, `${prefix}/thumb_${name}`];
        });
        const { error } = await deleteImagePaths(pathsToDelete);
        if (error) {
          console.error(error);
          alert("Failed to delete some images.");
          closeDialog();
          return;
        }
        queryClient.invalidateQueries({ queryKey: ["images", prefixes.primary, prefixes.legacy] });
        setFiles((prev) => {
          const next = { ...prev };
          names.forEach((name) => {
            if (next[name]?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(next[name].previewUrl!);
            delete next[name];
          });
          return next;
        });
        setSelectedFiles(new Set());
        closeDialog();
      },
    });
  };

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
      const prefix = oldEntry?.pathPrefix || prefixes.primary;
      const oldPath = `${prefix}/${oldName}`;
      const newPath = `${prefix}/${newName}`;
      const { error: moveError } = await moveImagePath(oldPath, newPath);
      if (moveError) {
        console.error("Move error:", moveError);
        alert("Failed to rename file");
        return;
      }
      if (oldEntry.thumbnailUrl) {
        await moveImagePath(`${prefix}/thumb_${oldName}`, `${prefix}/thumb_${newName}`).catch(() => {});
      }
      queryClient.invalidateQueries({ queryKey: ["images", prefixes.primary, prefixes.legacy] });
      const publicUrl = makeImagePublicUrl(prefix, newName);
      setFiles((prev) => {
        const updated = { ...prev };
        const entry = updated[oldName];
        delete updated[oldName];
        updated[newName] = {
          ...(entry ?? { name: newName, blob: new Blob(), uploaded: true, lastModified: Date.now(), progress: 100 }),
          name: newName,
          previewUrl: publicUrl,
          url: publicUrl,
          thumbnailUrl: entry?.thumbnailUrl?.replace(oldName, newName),
          pathPrefix: prefix,
        };
        return updated;
      });
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
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-600 border-t-blue-500"></div>
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
    />
  );
}
