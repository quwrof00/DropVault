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
  getFilePublicUrl,
  getFilesFolderPath,
  listStoredFiles,
  renameStoredFile,
  uploadStoredFile,
} from "./Files/actions";

type FilesProps = {
  roomId?: string | null;
};

export default function Files({ roomId }: FilesProps) {
  const user = useAuthUser();
  const navigate = useNavigate();
  const [files, setFiles] = useState<Record<string, FileEntry>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<any>({
    isOpen: false,
    title: "",
  });
  const [visibleCount, setVisibleCount] = useState(24);
  const [isRenaming, setIsRenaming] = useState(false);

  const { targetRef, isIntersecting } = useIntersectionObserver({ rootMargin: "200px" });
  const itemCounts = useItemCounts(roomId, "file");
  const progressIntervals = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    if (isIntersecting) {
      setVisibleCount((prev) => prev + 24);
    }
  }, [isIntersecting]);

  useEffect(() => {
    setVisibleCount(24);
  }, [searchTerm]);

  useEffect(() => {
    if (user === undefined) return;
    if (!user) {
      navigate("/login");
      return;
    }

    let cancelled = false;

    (async () => {
      setIsLoading(true);
      try {
        const folderPath = getFilesFolderPath(user.id, roomId);
        const { data: supabaseFiles, error } = await listStoredFiles(folderPath);

        if (error && error.message !== "The resource was not found") {
          console.error("Failed to fetch Supabase files", error);
        }

        const mergedFiles: Record<string, FileEntry> = {};
        supabaseFiles?.forEach((file) => {
          mergedFiles[file.name] = {
            name: file.name,
            blob: new Blob(),
            uploaded: true,
            lastModified: new Date(file.updated_at || file.created_at || Date.now()).getTime(),
            progress: 100,
            size: file.metadata?.size || 0,
          };
        });

        if (!cancelled) {
          setFiles(mergedFiles);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, navigate, roomId]);

  useEffect(() => {
    return () => {
      Object.values(progressIntervals.current).forEach(clearInterval);
    };
  }, []);

  const getPublicUrl = (fileName: string, lastModified?: number) => {
    if (!user) return undefined;
    const folderPath = getFilesFolderPath(user.id, roomId);
    return getFilePublicUrl(folderPath, fileName, lastModified);
  };

  const closeDialog = () => setDialog((prev: any) => ({ ...prev, isOpen: false }));

  const uploadToSupabase = async (fileEntry: FileEntry) => {
    if (!user) return;
    const folderPath = getFilesFolderPath(user.id, roomId);

    setUploadingFiles((prev) => new Set(prev).add(fileEntry.name));

    try {
      const { error } = await uploadStoredFile(folderPath, fileEntry);

      if (error) {
        console.error("Upload error:", error);
        const errorMsg = error.message.includes("already exists")
          ? "A file with this name already exists"
          : error.message;
        alert(`Failed to upload ${fileEntry.name}: ${errorMsg}`);

        setFiles((prev) => {
          const updated = { ...prev };
          delete updated[fileEntry.name];
          return updated;
        });
        return;
      }

      logActivity(user.id, "upload_file", fileEntry.name);

      setFiles((prev) => ({
        ...prev,
        [fileEntry.name]: {
          ...fileEntry,
          uploaded: true,
          progress: 100,
          size: fileEntry.blob.size,
        },
      }));
    } catch (err) {
      console.error("Upload exception:", err);
      alert(`Failed to upload ${fileEntry.name}`);
      setFiles((prev) => {
        const updated = { ...prev };
        delete updated[fileEntry.name];
        return updated;
      });
    } finally {
      if (progressIntervals.current[fileEntry.name]) {
        clearInterval(progressIntervals.current[fileEntry.name]);
        delete progressIntervals.current[fileEntry.name];
      }

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
      if (file.size > 50 * 1024 * 1024) {
        errors.push(`"${file.name}" is too large (max 50MB)`);
        continue;
      }

      const safeName = getSafeUniqueName(file.name, files);
      const finalFile = safeName === file.name ? file : new File([file], safeName, { type: file.type });
      validFiles.push(finalFile);
    }

    if (errors.length > 0) {
      alert(`Some files could not be uploaded:\n${errors.join("\n")}`);
    }

    for (const file of validFiles) {
      const newEntry: FileEntry = {
        name: file.name,
        blob: file,
        uploaded: false,
        lastModified: file.lastModified,
        progress: 0,
        size: file.size,
      };

      setFiles((prev) => ({ ...prev, [file.name]: newEntry }));

      let progress = 0;
      progressIntervals.current[file.name] = setInterval(() => {
        progress += Math.random() * 15 + 5;
        setFiles((prev) => ({
          ...prev,
          [file.name]: {
            ...prev[file.name],
            progress: Math.min(progress, 95),
          },
        }));
      }, 200);

      await uploadToSupabase(newEntry);
    }
  };

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file") {
          const file = item.getAsFile();
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
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOver(false);
    }
  };

  const handleDelete = (fileName: string) => {
    if (!user) return;

    setDialog({
      isOpen: true,
      title: "Delete File",
      message: `Are you sure you want to delete "${fileName}"?`,
      type: "confirm",
      confirmText: "Delete",
      variant: "danger",
      onConfirm: async () => {
        const folderPath = getFilesFolderPath(user.id, roomId);
        const { error } = await deleteStoredFile(folderPath, fileName);

        if (error) {
          alert(`Failed to delete file "${fileName}": ${error.message}`);
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
      alert(`File with name "${newName}" already exists!`);
      return;
    }

    if (!isValidFileName(newName)) {
      alert("Only letters, numbers, spaces, _ and - are allowed in the name.");
      return;
    }

    setIsRenaming(true);
    try {
      const folderPath = getFilesFolderPath(user.id, roomId);
      const { error } = await renameStoredFile(folderPath, oldName, newName);

      if (error) {
        console.error("Rename error:", error);
        alert("Failed to delete old file after renaming");
        return;
      }

      setFiles((prev) => {
        const updatedFiles = { ...prev };
        const entry = updatedFiles[oldName];
        delete updatedFiles[oldName];
        updatedFiles[newName] = {
          ...entry,
          name: newName,
        };
        return updatedFiles;
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
      getPublicUrl={getPublicUrl}
    />
  );
}
