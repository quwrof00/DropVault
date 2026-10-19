import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthUser } from "../../hooks/useAuthUser";
import { useItemCounts } from "../../hooks/useItemCounts";
import { useIntersectionObserver } from "../../hooks/useIntersectionObserver";
import { logActivity } from "../../lib/activity";
import FilesView from "./Files/FilesView";
import {
  type StoredFileEntry as FileEntry,
  getSafeUniqueName,
  isValidFileName,
} from "./Files/helpers";
import {
  deleteStoredFile,
  deleteLegacyStorageFile,
  downloadAndDecryptFile,
  getFilePublicUrl,
  getFilesFolderPath,
  listLegacyStorageFiles,
  listStoredFiles,
  renameStoredFile,
  uploadEncryptedFile,
  type FileMetadataRow,
} from "./Files/actions";

type FilesProps = {
  roomId?: string | null;
};

/** Extended entry type: encrypted files carry _meta; legacy files carry _legacyPath. */
type ExtendedFileEntry = FileEntry & {
  _meta?: FileMetadataRow;
  /** Folder path needed to resolve a public URL for legacy files. */
  _legacyPath?: string;
};

export default function Files({ roomId }: FilesProps) {
  const user = useAuthUser();
  const navigate = useNavigate();

  // Keyed by original_name for UI display, value carries the metadata row too.
  const [files, setFiles] = useState<Record<string, ExtendedFileEntry>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<any>({ isOpen: false, title: "" });
  const [visibleCount, setVisibleCount] = useState(24);
  const [isRenaming, setIsRenaming] = useState(false);

  const { targetRef, isIntersecting } = useIntersectionObserver({ rootMargin: "200px" });
  const itemCounts = useItemCounts(roomId, "file");
  const progressIntervals = useRef<Record<string, NodeJS.Timeout>>({});

  // secretKey mirrors the Notes pattern: roomId takes priority for shared rooms.
  const secretKey = roomId ?? user?.id ?? "";

  useEffect(() => {
    if (isIntersecting) setVisibleCount((prev) => prev + 24);
  }, [isIntersecting]);

  useEffect(() => {
    setVisibleCount(24);
  }, [searchTerm]);

  // ─── Load file list: both encrypted (file_metadata) & legacy (Storage) ─────
  useEffect(() => {
    if (user === undefined) return;
    if (!user) { navigate("/login"); return; }

    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const folderPath = getFilesFolderPath(user.id, roomId);
        const [{ data: rows, error: metaError }, { data: legacyList, error: legacyError }] =
          await Promise.all([
            listStoredFiles(user.id, roomId),
            listLegacyStorageFiles(folderPath),
          ]);

        if (metaError && (metaError as any).message !== "The resource was not found") {
          console.error("Failed to fetch file metadata", metaError);
        }
        if (legacyError && (legacyError as any).message !== "The resource was not found") {
          console.error("Failed to list legacy storage files", legacyError);
        }

        const merged: Record<string, ExtendedFileEntry> = {};

        // 1. Encrypted files from file_metadata
        (rows ?? []).forEach((row: FileMetadataRow) => {
          merged[row.original_name] = {
            name: row.original_name,
            blob: new Blob(),
            uploaded: true,
            lastModified: new Date(row.created_at).getTime(),
            progress: 100,
            size: row.original_size,
            _meta: row,
          };
        });

        // 2. Legacy unencrypted files from Storage (pre-encryption)
        (legacyList ?? []).forEach((file) => {
          if (!file.name || file.name.endsWith(".enc")) return;
          if (!merged[file.name]) {
            merged[file.name] = {
              name: file.name,
              blob: new Blob(),
              uploaded: true,
              lastModified: new Date(file.updated_at || file.created_at || Date.now()).getTime(),
              progress: 100,
              size: file.metadata?.size || 0,
              _legacyPath: folderPath,
            };
          }
        });

        if (!cancelled) setFiles(merged);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user, navigate, roomId]);

  useEffect(() => {
    return () => { Object.values(progressIntervals.current).forEach(clearInterval); };
  }, []);

  const closeDialog = () => setDialog((prev: any) => ({ ...prev, isOpen: false }));

  // ─── Upload ────────────────────────────────────────────────────────────────
  const uploadToSupabase = async (file: File, displayName: string) => {
    if (!user || !secretKey) return;

    setUploadingFiles((prev) => new Set(prev).add(displayName));

    const id = crypto.randomUUID();

    try {
      const { error } = await uploadEncryptedFile({
        file,
        userId: user.id,
        roomId,
        secretKey,
        id,
      });

      if (error) {
        console.error("Upload error:", error);
        const errorMsg = (error as any).message?.includes("already exists")
          ? "A file with this name already exists"
          : (error as any).message;
        alert(`Failed to upload ${displayName}: ${errorMsg}`);

        setFiles((prev) => {
          const updated = { ...prev };
          delete updated[displayName];
          return updated;
        });
        return;
      }

      logActivity(user.id, "upload_file", displayName);

      // Refresh the metadata row from the server.
      const { data: rows } = await listStoredFiles(user.id, roomId);
      const newRow = (rows as FileMetadataRow[] | null)?.find((r) => r.id === id);

      setFiles((prev) => ({
        ...prev,
        [displayName]: {
          ...prev[displayName],
          uploaded: true,
          progress: 100,
          size: file.size,
          _meta: newRow,
        },
      }));
    } catch (err) {
      console.error("Upload exception:", err);
      alert(`Failed to upload ${displayName}`);
      setFiles((prev) => {
        const updated = { ...prev };
        delete updated[displayName];
        return updated;
      });
    } finally {
      if (progressIntervals.current[displayName]) {
        clearInterval(progressIntervals.current[displayName]);
        delete progressIntervals.current[displayName];
      }
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
      if (file.size > 50 * 1024 * 1024) {
        errors.push(`"${file.name}" is too large (max 50MB)`);
        continue;
      }
      const safeName = getSafeUniqueName(file.name, files);
      const finalFile = safeName === file.name ? file : new File([file], safeName, { type: file.type });
      validFiles.push(finalFile);
    }

    if (errors.length > 0) alert(`Some files could not be uploaded:\n${errors.join("\n")}`);

    for (const file of validFiles) {
      const displayName = file.name;
      const newEntry: FileEntry = {
        name: displayName,
        blob: file,
        uploaded: false,
        lastModified: file.lastModified,
        progress: 0,
        size: file.size,
      };

      setFiles((prev) => ({ ...prev, [displayName]: newEntry }));

      // Fake progress animation while the encryption + upload happen.
      let progress = 0;
      progressIntervals.current[displayName] = setInterval(() => {
        progress += Math.random() * 15 + 5;
        setFiles((prev) => ({
          ...prev,
          [displayName]: { ...prev[displayName], progress: Math.min(progress, 95) },
        }));
      }, 200);

      await uploadToSupabase(file, displayName);
    }
  };

  // ─── Clipboard paste ───────────────────────────────────────────────────────
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === "file") {
          const file = items[i].getAsFile();
          if (file) pastedFiles.push(file);
        }
      }
      if (pastedFiles.length > 0) { e.preventDefault(); await processFiles(pastedFiles); }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [files, user, roomId]);

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

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
  };

  // ─── Download: encrypted files decrypt in browser; legacy serve public URL ───
  const handleDownload = async (fileName: string) => {
    if (!user || !secretKey) return;
    const entry = files[fileName] as ExtendedFileEntry;

    // Legacy unencrypted file — just open the public URL in a new tab.
    if (entry?._legacyPath) {
      const url = getFilePublicUrl(entry._legacyPath, fileName, entry.lastModified);
      window.open(url, "_blank", "noreferrer");
      return;
    }

    const meta = entry?._meta;
    if (!meta) { alert("Encryption metadata not found for this file."); return; }

    setDownloadingFiles((prev) => new Set(prev).add(fileName));
    try {
      const { error } = await downloadAndDecryptFile(meta, secretKey);
      if (error) {
        if (error.message.includes("operation-specific reason")) {
          alert("Decryption failed — wrong passphrase or corrupted file.");
        } else {
          alert(`Download failed: ${error.message}`);
        }
      }
    } finally {
      setDownloadingFiles((prev) => {
        const next = new Set(prev);
        next.delete(fileName);
        return next;
      });
    }
  };

  // Legacy files can also be deleted via Storage directly.
  const handleDelete = (fileName: string) => {
    if (!user) return;
    const entry = files[fileName] as ExtendedFileEntry;
    const meta = entry?._meta;
    const legacyPath = entry?._legacyPath;
    if (!meta && !legacyPath) return;

    setDialog({
      isOpen: true,
      title: "Delete File",
      message: `Are you sure you want to delete "${fileName}"?`,
      type: "confirm",
      confirmText: "Delete",
      variant: "danger",
      onConfirm: async () => {
        let error: Error | null = null;

        if (meta) {
          // Encrypted file: delete Storage blob + metadata row.
          ({ error } = await deleteStoredFile(meta.storage_path));
        } else if (legacyPath) {
          // Legacy file: just remove from Storage.
          ({ error } = await deleteLegacyStorageFile(legacyPath, fileName));
        }

        if (error) {
          alert(`Failed to delete file "${fileName}": ${(error as any).message}`);
          closeDialog();
          return;
        }
        logActivity(user.id, "delete_file", fileName);
        setFiles((prev) => {
          const updated = { ...prev };
          delete updated[fileName];
          return updated;
        });
        closeDialog();
      },
    });
  };

  // ─── Rename ───────────────────────────────────────────────────────────
  const handleRename = async (oldName: string, newNameInput: string) => {
    if (!user || isRenaming) return;
    if (!newNameInput || newNameInput === oldName) {
      setRenamingFile(null); setNewFileName(""); return;
    }

    const oldExtIndex = oldName.lastIndexOf(".");
    const oldExt = oldExtIndex !== -1 ? oldName.slice(oldExtIndex) : "";
    const newExtIndex = newNameInput.lastIndexOf(".");
    const hasExtension = newExtIndex !== -1;
    const newName = (hasExtension ? newNameInput : newNameInput + oldExt).trim();

    if (files[newName]) { alert(`File with name "${newName}" already exists!`); return; }
    if (!isValidFileName(newName)) {
      alert("Only letters, numbers, spaces, _ and - are allowed in the name."); return;
    }

    const entry = files[oldName] as ExtendedFileEntry;
    const meta = entry?._meta;
    // Legacy files: rename is not supported (would require re-upload).
    if (!meta) {
      alert("Rename is only supported for newly uploaded encrypted files. To rename this legacy file, delete it and re-upload with the new name.");
      return;
    }

    setIsRenaming(true);
    try {
      const { error } = await renameStoredFile(meta.storage_path, newName);
      if (error) {
        console.error("Rename error:", error);
        alert("Failed to rename file");
        return;
      }

      setFiles((prev) => {
        const updatedFiles = { ...prev };
        const entry = updatedFiles[oldName];
        delete updatedFiles[oldName];
        updatedFiles[newName] = {
          ...entry,
          name: newName,
          _meta: entry._meta ? { ...entry._meta, original_name: newName } : undefined,
          _legacyPath: (entry as ExtendedFileEntry)._legacyPath,
        };
        return updatedFiles;
      });

      setRenamingFile(null);
      setNewFileName("");
    } finally {
      setIsRenaming(false);
    }
  };

  // ─── Public URL for legacy files ─────────────────────────────────────────────
  const getLegacyPublicUrl = (fileName: string, lastModified?: number) => {
    const entry = files[fileName] as ExtendedFileEntry | undefined;
    if (!entry?._legacyPath) return undefined;
    return getFilePublicUrl(entry._legacyPath, fileName, lastModified);
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
    .filter(([name]) => name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort(([, a], [, b]) => b.lastModified - a.lastModified);

  return (
    <FilesView
      roomId={roomId}
      files={files}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      dragOver={dragOver}
      isLoading={isLoading}
      visibleCount={visibleCount}
      filteredFiles={filteredFiles}
      expandedFile={expandedFile}
      renamingFile={renamingFile}
      newFileName={newFileName}
      setNewFileName={setNewFileName}
      setRenamingFile={setRenamingFile}
      isRenaming={isRenaming}
      uploadingFiles={uploadingFiles}
      downloadingFiles={downloadingFiles}
      itemCounts={itemCounts}
      dialog={dialog}
      closeDialog={closeDialog}
      targetRef={targetRef as any}
      onFileChange={handleFileChange}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onToggleDiscussion={(name) => setExpandedFile(expandedFile === name ? null : name)}
      onStartRename={(name) => {
        setRenamingFile(name);
        setNewFileName(name.replace(/\.[^/.]+$/, ""));
      }}
      onRename={handleRename}
      onDelete={handleDelete}
      onDownload={handleDownload}
      // For legacy files, pass the public URL so FilesView can render an <a> link.
      getPublicUrl={getLegacyPublicUrl}
    />
  );
}

