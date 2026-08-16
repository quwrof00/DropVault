import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthUser } from "../../hooks/useAuthUser";
import { encrypt } from "../../lib/crypto-helper";
import { type DialogProps } from "../UI/Dialog";
import { useItemCounts } from "../../hooks/useItemCounts";
import { logActivity } from "../../lib/activity";
import {
  buildNotesList,
  fetchUserEmailMap,
  getNoteId,
  parseNoteId,
  type NoteRow,
  type NotesUser as User,
} from "./Notes/helpers";
import {
  deleteNoteData,
  fetchNotes,
  insertNoteData,
  saveNoteData,
  updateNoteTitle,
} from "./Notes/actions";
import NotesView from "./Notes/NotesView";

type NotesProps = {
  roomId?: string | null;
};

export default function Notes({ roomId }: NotesProps) {
  const user = useAuthUser() as User | null | undefined;
  const queryClient = useQueryClient();
  const scopeKey = roomId ?? user?.id ?? "private";

  const [files, setFiles] = useState<Record<string, string>>({});
  const [currentFile, setCurrentFile] = useState("");
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Partial<DialogProps> & { isOpen: boolean }>({
    isOpen: false,
    title: "",
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDiscussionOpen, setIsDiscussionOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const itemCounts = useItemCounts(roomId, "note");

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const lastSavedTextRef = useRef("");
  const isInitialLoadRef = useRef(true);
  const decryptWorkerRef = useRef<Worker | null>(null);
  const noteTimestampsRef = useRef<Record<string, string | null>>({});
  const currentFileRef = useRef(currentFile);
  const textRef = useRef(text);
  const saveIdRef = useRef(0);

  useEffect(() => {
    currentFileRef.current = currentFile;
    textRef.current = text;
  }, [currentFile, text]);

  const closeDialog = () => setDialog((prev) => ({ ...prev, isOpen: false }));

  const showAlert = (message: string) => {
    setDialog({
      isOpen: true,
      title: "Alert",
      message,
      type: "alert",
      onConfirm: closeDialog,
    });
  };

  const saveNote = useCallback(async (fileId: string, content: string, forceImmediate = false) => {
    if (!user || !fileId) return;
    if (!isMountedRef.current && !forceImmediate) return;
    if (!forceImmediate && content === lastSavedTextRef.current) return;

    const { title } = parseNoteId(fileId);
    const saveId = ++saveIdRef.current;

    try {
      setIsSaving(true);
      const secretKey = roomId ?? user.id;
      const encrypted = await encrypt(content, secretKey);
      const noteData = {
        title,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        salt: encrypted.salt,
        updated_at: new Date().toISOString(),
      };

      const { error } = await saveNoteData(user.id, roomId, noteData);

      if (error) throw error;
      if (saveId !== saveIdRef.current) return;

      lastSavedTextRef.current = content;
      noteTimestampsRef.current[fileId] = noteData.updated_at;

      queryClient.setQueryData(["notes", scopeKey], (old: NoteRow[] | undefined) => {
        if (!old) return [{ ...noteData, user_id: user.id } as NoteRow];

        const exists = old.some((note) => getNoteId(note.user_id, note.title) === fileId);
        if (exists) {
          return old.map((note) =>
            getNoteId(note.user_id, note.title) === fileId ? { ...note, ...noteData } : note,
          );
        }
        return [{ ...noteData, user_id: user.id } as NoteRow, ...old];
      });

      if (isMountedRef.current) {
        setFiles((prev) => ({ ...prev, [fileId]: content }));
        setError(null);
      }
    } catch (err) {
      console.error("Save error:", err);
      if (isMountedRef.current) {
        setError("Failed to save note. Changes may be lost.");
      }
    } finally {
      if (isMountedRef.current) setIsSaving(false);
    }
  }, [user, roomId, queryClient, scopeKey]);

  const { data: supabaseNotes, isLoading: isQueryLoading, error: queryError } = useQuery({
    queryKey: ["notes", scopeKey],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await fetchNotes(user.id, roomId);
      if (error) throw error;
      return data as NoteRow[];
    },
    enabled: !!user,
  });

  const { data: userEmails } = useQuery({
    queryKey: ["note-users", supabaseNotes?.map((note) => note.user_id).filter(Boolean)],
    queryFn: async () => fetchUserEmailMap(supabaseNotes || []),
    enabled: !!supabaseNotes && supabaseNotes.length > 0,
  });

  useEffect(() => {
    if (!supabaseNotes || supabaseNotes.length === 0) {
      if (!isQueryLoading) {
        setFiles({});
        setIsLoading(false);
        setCurrentFile("");
        setText("");
        lastSavedTextRef.current = "";
        noteTimestampsRef.current = {};
        isInitialLoadRef.current = false;
      }
      return;
    }

    const secretKey = roomId ?? user?.id;
    if (!secretKey) return;

    const notesToDecrypt = supabaseNotes.filter((note) => {
      const id = getNoteId(note.user_id, note.title);
      return noteTimestampsRef.current[id] !== note.updated_at;
    });

    if (notesToDecrypt.length === 0) {
      setIsLoading(false);
      setIsDecrypting(false);
      isInitialLoadRef.current = false;
      return;
    }

    setIsLoading(false);
    setIsDecrypting(true);

    if (decryptWorkerRef.current) {
      decryptWorkerRef.current.terminate();
    }

    const worker = new Worker(new URL("../../workers/decryptWorker.ts", import.meta.url), {
      type: "module",
    });
    decryptWorkerRef.current = worker;

    let firstDecrypted = false;

    worker.onmessage = (e) => {
      const { type, payload } = e.data;

      if (type === "batch") {
        const batchResults: Record<string, string> = {};

        payload.forEach((item: { title: string; content: string; updated_at: string; user_id?: string }) => {
          const id = getNoteId(item.user_id, item.title);
          if (noteTimestampsRef.current[id] && noteTimestampsRef.current[id] !== item.updated_at) {
            return;
          }

          batchResults[id] = item.content;
          const sourceNote = notesToDecrypt.find((note) => getNoteId(note.user_id, note.title) === id);
          if (sourceNote) {
            noteTimestampsRef.current[id] = sourceNote.updated_at;
          }
        });

        const activeFile = currentFileRef.current;
        if (!firstDecrypted && !activeFile) {
          const candidate = payload.find((item: { title: string }) => !item.title.endsWith("/.placeholder"));
          if (candidate) {
            const candidateId = getNoteId(candidate.user_id, candidate.title);
            firstDecrypted = true;
            setCurrentFile(candidateId);
            currentFileRef.current = candidateId;
            setText(candidate.content);
            textRef.current = candidate.content;
            lastSavedTextRef.current = candidate.content;
          }
        }

        if (activeFile && batchResults[activeFile] !== undefined) {
          if (textRef.current === lastSavedTextRef.current) {
            setText(batchResults[activeFile]);
            textRef.current = batchResults[activeFile];
            lastSavedTextRef.current = batchResults[activeFile];
          } else {
            delete batchResults[activeFile];
          }
        }

        setFiles((prev) => ({ ...prev, ...batchResults }));
      }

      if (type === "done") {
        setIsDecrypting(false);
        isInitialLoadRef.current = false;
      }
    };

    worker.onerror = (err) => {
      console.error("Worker error:", err);
      setError("Error decrypting notes.");
      setIsDecrypting(false);
    };

    worker.postMessage({ notes: notesToDecrypt, secretKey });

    return () => {
      worker.terminate();
    };
  }, [supabaseNotes, user?.id, roomId]);

  useEffect(() => {
    if (queryError) {
      console.error("Failed to fetch Supabase notes", queryError);
      const errorMessage = queryError instanceof Error ? queryError.message : JSON.stringify(queryError);
      setError(`Failed to load notes: ${errorMessage}`);
      setFiles({});
      setIsLoading(false);
    }
  }, [queryError]);

  useEffect(() => {
    if (isQueryLoading) {
      setIsLoading(true);
    }
  }, [isQueryLoading]);

  const forceSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (throttleTimeoutRef.current) {
      clearTimeout(throttleTimeoutRef.current);
      throttleTimeoutRef.current = null;
    }

    const fileId = currentFileRef.current;
    const currentText = textRef.current;
    if (user && fileId && currentText !== lastSavedTextRef.current) {
      saveNote(fileId, currentText, true).catch(console.error);
    }
  }, [user, saveNote]);

  const scheduleSave = useCallback(() => {
    if (isInitialLoadRef.current) return;

    if (!throttleTimeoutRef.current) {
      throttleTimeoutRef.current = setTimeout(() => {
        forceSave();
      }, 5000);
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      forceSave();
    }, 1500);
  }, [forceSave]);

  useEffect(() => {
    if (!user) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        forceSave();
      }
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (textRef.current !== lastSavedTextRef.current) {
        forceSave();
        event.preventDefault();
        event.returnValue = "";
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [user, forceSave]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      forceSave();

      if (decryptWorkerRef.current) {
        decryptWorkerRef.current.terminate();
      }
    };
  }, [forceSave]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFullScreen && e.key === "Escape") {
        setIsFullScreen(false);
        return;
      }

      if (e.key.toLowerCase() === "f") {
        const target = e.target as HTMLElement;
        const isTyping = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

        if (!isTyping) {
          e.preventDefault();
          setIsFullScreen((prev) => !prev);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullScreen]);

  const handleFileSelect = (fileId: string) => {
    let currentFiles = files;

    if (currentFile && text !== lastSavedTextRef.current) {
      currentFiles = { ...files, [currentFile]: text };
      setFiles(currentFiles);
      forceSave();
    }

    setCurrentFile(fileId);
    currentFileRef.current = fileId;
    setText(currentFiles[fileId] || "");
    textRef.current = currentFiles[fileId] || "";
    lastSavedTextRef.current = currentFiles[fileId] || "";
    setError(null);
  };

  const getPathFromId = useCallback((id: string) => parseNoteId(id).title, []);

  const handleNewFolder = useCallback(() => {
    if (!user) return;

    setDialog({
      isOpen: true,
      title: "New Folder",
      message: "Enter folder name:",
      type: "input",
      placeholder: "Folder Name",
      confirmText: "Create",
      onConfirm: async (name) => {
        if (!name?.trim()) return;

        const trimmedName = name.trim();
        if (trimmedName.includes("/")) {
          showAlert("Folder name cannot contain '/'");
          return;
        }

        const folderExists = Object.keys(files).some((id) => {
          const path = getPathFromId(id);
          return path === trimmedName || path.startsWith(`${trimmedName}/`);
        });

        if (folderExists) {
          showAlert(`Folder "${trimmedName}" already exists!`);
          return;
        }

        const placeholderPath = `${trimmedName}/.placeholder`;

        try {
          const secretKey = roomId ?? user.id;
          const encrypted = await encrypt("", secretKey);
          
          const { error } = await insertNoteData(user.id, roomId, placeholderPath, encrypted);

          if (error) throw error;

          const placeholderId = getNoteId(user.id, placeholderPath);
          setFiles((prev) => ({ ...prev, [placeholderId]: "" }));
          closeDialog();
        } catch (err) {
          console.error("Error creating folder:", err);
          showAlert("Failed to create folder.");
        }
      },
    });
  }, [files, getPathFromId, roomId, user]);

  const handleNewFile = useCallback(
    (prefillPath?: string) => {
      if (!user) return;

      const initialValue = prefillPath ? `${prefillPath}/` : "";

      setDialog({
        isOpen: true,
        title: "New Note",
        message: "Enter full path for your note:",
        type: "input",
        placeholder: "folder/note-name",
        defaultValue: initialValue,
        confirmText: "Create",
        showCheckbox: !!roomId,
        checkboxLabel: "Live Collaborative Note (Instant sync for everyone)",
        defaultCheckboxValue: false,
        onConfirm: async (name, isCollaborative) => {
          if (!name?.trim()) return;

          const trimmedName = name.trim();
          const newId = getNoteId(user.id, trimmedName);
          if (files[newId]) {
            showAlert(`Note with title "${trimmedName}" already exists!`);
            return;
          }

          setIsCreating(true);
          try {
            const secretKey = roomId ?? user.id;
            const encrypted = await encrypt("", secretKey);
            const newNoteRow: NoteRow = {
              title: trimmedName,
              ciphertext: encrypted.ciphertext,
              iv: encrypted.iv,
              salt: encrypted.salt,
              updated_at: new Date().toISOString(),
              is_collaborative: isCollaborative ?? false,
              user_id: user.id,
            };

            const { error } = await insertNoteData(user.id, roomId, trimmedName, encrypted, isCollaborative ?? false);

            if (error) throw error;

            queryClient.setQueryData(["notes", scopeKey], (old: NoteRow[] | undefined) => {
              if (Array.isArray(old)) return [newNoteRow, ...old];
              return [newNoteRow];
            });

            noteTimestampsRef.current[newId] = newNoteRow.updated_at;
            queryClient.invalidateQueries({ queryKey: ["notes", scopeKey] });

            setFiles((prev) => ({ ...prev, [newId]: "" }));
            setCurrentFile(newId);
            currentFileRef.current = newId;
            setText("");
            textRef.current = "";
            lastSavedTextRef.current = "";

            logActivity(user.id, "create_note", trimmedName);
            closeDialog();
          } catch (err) {
            console.error("Error creating note:", err);
            showAlert("Failed to create note.");
          } finally {
            setIsCreating(false);
          }
        },
      });
    },
    [files, queryClient, roomId, scopeKey, user],
  );

  const handleDelete = useCallback(
    (fileId: string) => {
      if (!user) return;

      const filePath = getPathFromId(fileId);
      const isFolder = Object.keys(files).some((id) => {
        const path = getPathFromId(id);
        return id !== fileId && path.startsWith(`${filePath}/`);
      });
      const itemName = filePath.split("/").pop() || filePath;

      setDialog({
        isOpen: true,
        title: `Delete ${isFolder ? "Folder" : "Note"}`,
        message: `Are you sure you want to delete "${itemName}"?${isFolder ? " This will delete all notes inside." : ""}`,
        type: "confirm",
        confirmText: "Delete",
        variant: "danger",
        onConfirm: async () => {
          try {
            if (isFolder) {
              const filesToDelete = Object.keys(files).filter((id) => getPathFromId(id).startsWith(`${filePath}/`));

              for (const id of filesToDelete) {
                const title = getPathFromId(id);
                const { error } = await deleteNoteData(title, user.id, roomId);
                if (error) throw error;
              }

              setFiles((prev) => {
                const updated = { ...prev };
                filesToDelete.forEach((id) => delete updated[id]);
                return updated;
              });

              logActivity(user.id, "delete_folder", itemName);

              if (currentFile && getPathFromId(currentFile).startsWith(`${filePath}/`)) {
                setCurrentFile("");
                currentFileRef.current = "";
                setText("");
                textRef.current = "";
                lastSavedTextRef.current = "";
              }
            } else {
              const { error } = await deleteNoteData(filePath, user.id, roomId);
              if (error) throw error;

              queryClient.invalidateQueries({ queryKey: ["notes", scopeKey] });

              setFiles((prev) => {
                const updated = { ...prev };
                delete updated[fileId];
                return updated;
              });

              logActivity(user.id, "delete_note", itemName);

              if (fileId === currentFile) {
                setCurrentFile("");
                currentFileRef.current = "";
                setText("");
                textRef.current = "";
                lastSavedTextRef.current = "";
              }
            }

            closeDialog();
          } catch (err) {
            console.error("Delete failed:", err);
            showAlert("Failed to delete.");
          }
        },
      });
    },
    [currentFile, files, getPathFromId, queryClient, scopeKey, user, roomId],
  );

  const handleRename = useCallback(
    (fileId: string) => {
      if (!user) return;

      const filePath = getPathFromId(fileId);
      const isFolder = Object.keys(files).some((id) => id !== fileId && getPathFromId(id).startsWith(`${filePath}/`));
      const oldName = filePath.split("/").pop() || filePath;

      setDialog({
        isOpen: true,
        title: `Rename ${isFolder ? "Folder" : "Note"}`,
        type: "input",
        defaultValue: oldName,
        confirmText: "Rename",
        onConfirm: async (newName) => {
          if (!newName?.trim() || newName.trim() === oldName) {
            closeDialog();
            return;
          }

          const trimmedName = newName.trim();
          if (trimmedName.includes("/")) {
            showAlert("Name cannot contain '/' character");
            return;
          }

          const pathParts = filePath.split("/");
          pathParts[pathParts.length - 1] = trimmedName;
          const newPath = pathParts.join("/");
          const newId = getNoteId(user.id, newPath);

          if (files[newId]) {
            showAlert(`A ${isFolder ? "folder" : "note"} with name "${trimmedName}" already exists!`);
            return;
          }

          try {
            if (isFolder) {
              const itemsToRename = Object.keys(files).filter((id) => getPathFromId(id).startsWith(`${filePath}/`));

              for (const id of itemsToRename) {
                const oldPath = getPathFromId(id);
                const renamedPath = oldPath.replace(filePath, newPath);
                
                const { error } = await updateNoteTitle(oldPath, renamedPath, user.id, roomId);
                if (error) throw error;
              }

              setFiles((prev) => {
                const updated: Record<string, string> = {};
                Object.entries(prev).forEach(([id, content]) => {
                  const path = getPathFromId(id);
                  if (path.startsWith(`${filePath}/`)) {
                    updated[getNoteId(user.id, path.replace(filePath, newPath))] = content;
                  } else {
                    updated[id] = content;
                  }
                });
                return updated;
              });

              if (currentFile && getPathFromId(currentFile).startsWith(`${filePath}/`)) {
                const renamedCurrent = getNoteId(user.id, getPathFromId(currentFile).replace(filePath, newPath));
                setCurrentFile(renamedCurrent);
                currentFileRef.current = renamedCurrent;
              }
            } else {
              const { error } = await updateNoteTitle(filePath, newPath, user.id, roomId);
              if (error) throw error;

              queryClient.invalidateQueries({ queryKey: ["notes", scopeKey] });

              setFiles((prev) => {
                const updated = { ...prev };
                delete updated[fileId];
                updated[newId] = files[fileId];
                return updated;
              });

              if (fileId === currentFile) {
                setCurrentFile(newId);
                currentFileRef.current = newId;
              }
            }

            closeDialog();
          } catch (err) {
            console.error(err);
            showAlert("Failed to rename.");
          }
        },
      });
    },
    [currentFile, files, getPathFromId, queryClient, roomId, scopeKey, user],
  );

  const handleTextUpdate = useCallback(
    (newText: string) => {
      setText(newText);
      textRef.current = newText;
      scheduleSave();
    },
    [scheduleSave],
  );

  const allFilePaths = buildNotesList(files);
  const currentNote = supabaseNotes?.find((note) => getNoteId(note.user_id, note.title) === currentFile);
  const isReadOnly = currentNote?.user_id !== user?.id;
  const currentPath = currentFile ? parseNoteId(currentFile).title : "";

  return (
    <NotesView
      roomId={roomId}
      user={user}
      isLoading={isLoading}
      isDecrypting={isDecrypting}
      error={error}
      setError={setError}
      dialog={dialog}
      closeDialog={closeDialog}
      search={search}
      setSearch={setSearch}
      allFilePaths={allFilePaths}
      handleNewFile={handleNewFile}
      handleNewFolder={handleNewFolder}
      handleFileSelect={handleFileSelect}
      handleRename={handleRename}
      handleDelete={handleDelete}
      currentFile={currentFile}
      isCreating={isCreating}
      isSidebarOpen={isSidebarOpen}
      setIsSidebarOpen={setIsSidebarOpen}
      itemCounts={itemCounts}
      supabaseNotes={supabaseNotes || undefined}
      userEmails={userEmails}
      currentPath={currentPath}
      isSaving={isSaving}
      isDiscussionOpen={isDiscussionOpen}
      setIsDiscussionOpen={setIsDiscussionOpen}
      isFullScreen={isFullScreen}
      setIsFullScreen={setIsFullScreen}
      currentNote={currentNote}
      isReadOnly={isReadOnly}
      text={text}
      handleTextUpdate={handleTextUpdate}
      files={files}
    />
  );
}
