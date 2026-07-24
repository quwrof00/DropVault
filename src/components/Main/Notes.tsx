import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase-client";
import { useAuthUser } from "../../hooks/useAuthUser";
// import { useNavigate } from"react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Editor from "../Editor/Editor";
import CollabEditor from "../CollabEditor";
import { encrypt } from "../../lib/crypto-helper";
import SubSidebar from "../PageHelpers/SubSidebar";
import { Dialog, type DialogProps } from "../UI/Dialog";
import ItemDiscussion from "./ItemDiscussion";
import { useItemCounts } from "../../hooks/useItemCounts";
import { logActivity } from "../../lib/activity";


interface User {
  id: string;
}

type NotesProps = {
  roomId?: string | null;
};

interface NoteRow {
  title: string;
  ciphertext: string | null;
  iv: string | null;
  salt: string | null;
  updated_at: string | null;
  is_collaborative?: boolean | null;
}

export default function Notes({ roomId }: NotesProps) {
  const user = useAuthUser() as User | null | undefined;
  // const navigate = useNavigate();

  const [files, setFiles] = useState<{ [key: string]: string }>({});
  const [currentFile, setCurrentFile] = useState<string>("");

  const [text, setText] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Partial<DialogProps> & { isOpen: boolean }>({ isOpen: false, title: "" });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDiscussionOpen, setIsDiscussionOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Real-time comment counts
  const itemCounts = useItemCounts(roomId, 'note');

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const lastSavedTextRef = useRef<string>("");
  const isInitialLoadRef = useRef(true);

  // Worker ref
  const decryptWorkerRef = useRef<Worker | null>(null);
  const noteTimestampsRef = useRef<Record<string, string | null>>({});

  const currentFileRef = useRef(currentFile);
  const textRef = useRef(text);
  const saveIdRef = useRef(0);

  useEffect(() => {
    currentFileRef.current = currentFile;
    textRef.current = text;
  }, [currentFile, text]);

  // Dedicated Save Function
  const saveNote = async (fileName: string, content: string, forceImmediate = false) => {
    if (!user || !fileName) return;
    if (!isMountedRef.current && !forceImmediate) return;

    // Skip if no changes, unless forced
    if (!forceImmediate && content === lastSavedTextRef.current) return;

    const saveId = ++saveIdRef.current;

    try {
      setIsSaving(true);
      const secretKey = roomId ?? user.id;
      const encrypted = await encrypt(content, secretKey);

      const noteData = {
        title: fileName,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        salt: encrypted.salt,
        updated_at: new Date().toISOString()
      };

      let query;

      if (roomId) {
        query = supabase
          .from("notes")
          .upsert({
            ...noteData,
            room_id: roomId,
            user_id: null
          }, { onConflict: 'room_id,title' });
      } else {
        query = supabase
          .from("notes")
          .upsert({
            ...noteData,
            user_id: user.id,
            room_id: null
          }, { onConflict: 'user_id,title' });
      }

      const { error } = await query;

      if (error) throw error;
      if (saveId !== saveIdRef.current) return;

      lastSavedTextRef.current = content;
      noteTimestampsRef.current[fileName] = noteData.updated_at;
      
      queryClient.setQueryData(["notes", roomId ?? user.id], (old: NoteRow[] | undefined) => {
        if (!old) return [{ ...noteData } as NoteRow];
        
        const exists = old.some(note => note.title === fileName);
        if (exists) {
          return old.map(note => 
            note.title === fileName ? { ...note, ...noteData, content } : note
          );
        } else {
          return [{ ...noteData, content } as any, ...old];
        }
      });
      
      if (isMountedRef.current) {
        setFiles(prev => ({ ...prev, [fileName]: content }));
        setError(null);
      }
      
      console.log(`Successfully saved: ${fileName}`);

    } catch (err) {
      console.error("Save error:", err);
      if (isMountedRef.current) {
        setError("Failed to save note. Changes may be lost.");
      }
    } finally {
      if (isMountedRef.current) setIsSaving(false);
    }
  };

  const queryClient = useQueryClient();

  // 1. Define the query for fetching encrypted notes
  const { data: supabaseNotes, isLoading: isQueryLoading, error: queryError } = useQuery({
    queryKey: ["notes", roomId ?? user?.id],
    queryFn: async () => {
      if (!user) return null;
      let query = supabase
        .from("notes")
        .select("title, ciphertext, iv, salt, updated_at, is_collaborative");

      if (roomId) {
        query = query.eq("room_id", roomId);
      } else {
        query = query.eq("user_id", user.id).is("room_id", null);
      }

      query = query.order("updated_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data as NoteRow[];
    },
    enabled: !!user,
  });

  // 2. Handle decryption when query data is available
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

    const notesToDecrypt = supabaseNotes.filter(note => {
      return noteTimestampsRef.current[note.title] !== note.updated_at;
    });

    if (notesToDecrypt.length === 0) {
      setIsLoading(false);
      setIsDecrypting(false);
      isInitialLoadRef.current = false;
      return;
    }

    setIsLoading(false);
    setIsDecrypting(true);

    // Terminate existing worker if any
    if (decryptWorkerRef.current) {
      decryptWorkerRef.current.terminate();
    }

    // Initialize new worker
    const worker = new Worker(new URL('../../workers/decryptWorker.ts', import.meta.url), {
      type: 'module'
    });
    decryptWorkerRef.current = worker;

    let firstDecrypted = false;

    worker.onmessage = (e) => {
      const { type, payload } = e.data;

      if (type === 'batch') {
        const batchResults: Record<string, string> = {};
        payload.forEach((item: { title: string; content: string; updated_at: string }) => {
          // If we have saved this file locally with a newer timestamp, discard the worker's result!
          if (noteTimestampsRef.current[item.title] && noteTimestampsRef.current[item.title] !== item.updated_at) {
            return;
          }
          batchResults[item.title] = item.content;
          const sourceNote = notesToDecrypt.find(n => n.title === item.title);
          if (sourceNote) {
            noteTimestampsRef.current[item.title] = sourceNote.updated_at;
          }
        });

        const activeFile = currentFileRef.current;
        if (!firstDecrypted && !activeFile) {
          const candidate = payload.find((p: { title: string }) => !p.title.endsWith("/.placeholder"));
          if (candidate) {
            firstDecrypted = true;
            setCurrentFile(candidate.title);
            currentFileRef.current = candidate.title;
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
            // User is typing. Discard the stale decrypted result for the active file.
            delete batchResults[activeFile];
          }
        }

        setFiles(prev => ({
          ...prev,
          ...batchResults
        }));
      } else if (type === 'done') {
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
  }, [supabaseNotes, user?.id, roomId, isQueryLoading]);

  // Handle query errors
  useEffect(() => {
    if (queryError) {
      console.error("Failed to fetch Supabase notes", queryError);
      setError("Failed to load notes. Please try again.");
      setFiles({});
      setIsLoading(false);
    }
  }, [queryError]);

  // Sync isLoading with query state (only for initial load)
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
    const file = currentFileRef.current;
    const t = textRef.current;
    if (user && file && t !== lastSavedTextRef.current) {
      saveNote(file, t, true).catch(console.error);
    }
  }, [user]);

  const scheduleSave = useCallback(() => {
    if (isInitialLoadRef.current) return;
    
    // Set a hard throttle ceiling (5s) so they don't type infinitely without saving
    if (!throttleTimeoutRef.current) {
      throttleTimeoutRef.current = setTimeout(() => {
        forceSave();
      }, 5000);
    }

    // Debounce inactivity (1.5s)
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      forceSave();
    }, 1500);
  }, [forceSave]);

  // Save on visibility change and unload
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
        event.returnValue = '';
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [user, forceSave]);

  // Component cleanup
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

  // Handle Keyboard shortcuts (Esc, F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to exit
      if (isFullScreen && e.key === 'Escape') {
        setIsFullScreen(false);
        return;
      }

      //'f' to toggle full screen (if not typing)
      if (e.key.toLowerCase() === 'f') {
        const target = e.target as HTMLElement;
        const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

        if (!isTyping) {
          e.preventDefault();
          setIsFullScreen(prev => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen]);

  const handleFileSelect = (file: string) => {
    let currentFiles = files;
    
    // Save current file text synchronously to state before switching
    if (currentFile && text !== lastSavedTextRef.current) {
      currentFiles = { ...files, [currentFile]: text };
      setFiles(currentFiles);
      forceSave();
    }

    setCurrentFile(file);
    currentFileRef.current = file;
    setText(currentFiles[file] || "");
    textRef.current = currentFiles[file] || "";
    lastSavedTextRef.current = currentFiles[file] || "";
    setError(null);
  };

  // Dialog Helpers
  const closeDialog = () => setDialog(prev => ({ ...prev, isOpen: false }));

  const showAlert = (message: string) => {
    setDialog({
      isOpen: true,
      title: "Alert",
      message,
      type: "alert",
      onConfirm: closeDialog
    });
  };

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
          showAlert("Folder name cannot contain'/'");
          return;
        }

        const fullPath = trimmedName;
        const folderExists = Object.keys(files).some(path =>
          path === fullPath || path.startsWith(fullPath + "/")
        );

        if (folderExists) {
          showAlert(`Folder"${trimmedName}" already exists!`);
          return;
        }

        const placeholderPath = `${fullPath}/.placeholder`;
        try {
          const secretKey = roomId ?? user.id;
          const encrypted = await encrypt("", secretKey);
          const { error } = await supabase.from("notes").insert({
            user_id: roomId ? null : user.id,
            room_id: roomId ?? null,
            title: placeholderPath,
            ciphertext: encrypted.ciphertext,
            iv: encrypted.iv,
            salt: encrypted.salt,
          });

          if (error) throw error;
          setFiles(prev => ({ ...prev, [placeholderPath]: "" }));
          closeDialog();
        } catch (err) {
          console.error("Error creating folder:", err);
          showAlert("Failed to create folder.");
        }
      }
    });
  }, [user, roomId, files]);


  const handleNewFile = useCallback((prefillPath?: string) => {
    if (!user) return;

    // Determine default value: prefillPath > currentFolder
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

        if (files[trimmedName]) {
          showAlert(`Note with title"${trimmedName}" already exists!`);
          return;
        }

        setIsCreating(true);
        try {
          const secretKey = roomId ?? user.id;
          const encrypted = await encrypt("", secretKey);
          const newNoteRow = {
            title: trimmedName,
            ciphertext: encrypted.ciphertext,
            iv: encrypted.iv,
            salt: encrypted.salt,
            updated_at: new Date().toISOString(),
            is_collaborative: isCollaborative ?? false
          };

          const { error } = await supabase.from("notes").insert({
            user_id: roomId ? null : user.id,
            room_id: roomId ?? null,
            title: trimmedName,
            ciphertext: encrypted.ciphertext,
            iv: encrypted.iv,
            salt: encrypted.salt,
            is_collaborative: isCollaborative ?? false
          });

          if (error) throw error;

          queryClient.setQueryData(["notes", roomId ?? user.id], (old: any) => {
            if (Array.isArray(old)) return [newNoteRow, ...old];
            return [newNoteRow];
          });

          noteTimestampsRef.current[trimmedName] = newNoteRow.updated_at;
          queryClient.invalidateQueries({ queryKey: ["notes", roomId ?? user.id] });

          setFiles((prev) => ({ ...prev, [trimmedName]: "" }));
          setCurrentFile(trimmedName);
          currentFileRef.current = trimmedName;
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
      }
    });
  }, [user, roomId, files]);

  const handleDelete = useCallback((file: string) => {
    if (!user) return;
    const isFolder = Object.keys(files).some(path => path !== file && path.startsWith(file + '/'));
    const itemName = file.split('/').pop() || file;

    setDialog({
      isOpen: true,
      title: `Delete ${isFolder ? 'Folder' : 'Note'}`,
      message: `Are you sure you want to delete"${itemName}"?${isFolder ? ' This will delete all notes inside.' : ''}`,
      type: "confirm",
      confirmText: "Delete",
      variant: "danger",
      onConfirm: async () => {
        try {
          if (isFolder) {
            const filesToDelete = Object.keys(files).filter(path => path.startsWith(file + '/'));
            for (const path of filesToDelete) {
              const deleteQuery = supabase.from("notes").delete().eq("title", path);
              if (roomId) deleteQuery.eq("room_id", roomId);
              else deleteQuery.is("room_id", null).eq("user_id", user.id);

              const { error } = await deleteQuery;
              if (error) throw error;
            }
            setFiles(prev => {
              const updated = { ...prev };
              filesToDelete.forEach(path => delete updated[path]);
              return updated;
            });

            logActivity(user.id, "delete_folder", itemName);

            if (currentFile.startsWith(file + '/')) {
              setCurrentFile("");
              currentFileRef.current = "";
              setText("");
              textRef.current = "";
              lastSavedTextRef.current = "";
            }
          } else {
            const deleteQuery = supabase.from("notes").delete().eq("title", file);
            if (roomId) deleteQuery.eq("room_id", roomId);
            else deleteQuery.is("room_id", null).eq("user_id", user.id);

            const { error } = await deleteQuery;
            if (error) throw error;

            queryClient.invalidateQueries({ queryKey: ["notes", roomId ?? user.id] });

            setFiles(prev => {
              const updated = { ...prev };
              delete updated[file];
              return updated;
            });

            logActivity(user.id, "delete_note", itemName);

            if (file === currentFile) {
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
      }
    });
  }, [user, roomId, files, currentFile]);

  const handleRename = useCallback((file: string) => {
    if (!user) return;
    const isFolder = Object.keys(files).some(path => path !== file && path.startsWith(file + '/'));
    const oldName = file.split('/').pop() || file;

    setDialog({
      isOpen: true,
      title: `Rename ${isFolder ? 'Folder' : 'Note'}`,
      type: "input",
      defaultValue: oldName,
      confirmText: "Rename",
      onConfirm: async (newName) => {
        if (!newName?.trim() || newName.trim() === oldName) {
          closeDialog();
          return;
        }

        const trimmedName = newName.trim();
        if (trimmedName.includes('/')) {
          showAlert("Name cannot contain'/' character");
          return;
        }

        const pathParts = file.split('/');
        pathParts[pathParts.length - 1] = trimmedName;
        const newPath = pathParts.join('/');

        if (files[newPath]) {
          showAlert(`A ${isFolder ? 'folder' : 'note'} with name"${trimmedName}" already exists!`);
          return;
        }

        try {
          if (isFolder) {
            const itemsToRename = Object.keys(files).filter(path => path.startsWith(file + '/'));
            for (const path of itemsToRename) {
              const newItemPath = path.replace(file, newPath);
              const updateQuery = supabase.from("notes").update({ title: newItemPath }).eq("title", path);
              if (roomId) updateQuery.eq("room_id", roomId);
              else updateQuery.is("room_id", null).eq("user_id", user.id);
              const { error } = await updateQuery;
              if (error) throw error;
            }

            setFiles(prev => {
              const updated: { [key: string]: string } = {};
              Object.keys(prev).forEach(key => {
                if (key.startsWith(file + '/')) {
                  updated[key.replace(file, newPath)] = prev[key];
                } else {
                  updated[key] = prev[key];
                }
              });
              return updated;
            });
            if (currentFile.startsWith(file + '/')) {
              const newCur = currentFile.replace(file, newPath);
              setCurrentFile(newCur);
              currentFileRef.current = newCur;
            }
          } else {
            const updateQuery = supabase.from("notes").update({ title: newPath }).eq("title", file);
            if (roomId) updateQuery.eq("room_id", roomId);
            else updateQuery.is("room_id", null).eq("user_id", user.id);
            const { error } = await updateQuery;
            if (error) throw error;

            queryClient.invalidateQueries({ queryKey: ["notes", roomId ?? user.id] });

            setFiles(prev => {
              const updated = { ...prev };
              delete updated[file];
              updated[newPath] = files[file]; // Keep content
              return updated;
            });

            if (file === currentFile) {
              setCurrentFile(newPath);
              currentFileRef.current = newPath;
            }
          }
          closeDialog();
        } catch (err) {
          console.error(err);
          showAlert("Failed to rename.");
        }
      }
    });
  }, [user, roomId, files, currentFile]);

  const handleTextUpdate = useCallback((newText: string) => {
    setText(newText);
    textRef.current = newText;
    scheduleSave();
  }, [scheduleSave]);

  // Get all file paths (excluding placeholders) for SubSidebar to build tree
  const allFilePaths = Object.keys(files);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] bg-gray-700 rounded-lg shadow-lg items-center justify-center">
        <div className="flex items-center space-x-3 text-gray-300">
          <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading notes...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-full bg-gray-700 rounded-lg shadow-lg overflow-hidden relative">
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2">
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-2 text-red-200 hover:text-white">✕</button>
        </div>
      )}

      <Dialog
        onClose={closeDialog}
        {...dialog}
        isOpen={dialog.isOpen}
        title={dialog.title || ""}
      />

      <SubSidebar
        search={search}
        setSearch={setSearch}
        items={allFilePaths}
        onCreate={(path) => handleNewFile(path)}
        onCreateFileInFolder={(path) => handleNewFile(path)}
        onCreateFolder={handleNewFolder}
        onSelect={(file) => {
          handleFileSelect(file);
          setIsSidebarOpen(false); // Close sidebar on selection (mobile)
        }}
        onRename={handleRename}
        onDelete={handleDelete}
        currentItem={currentFile}
        typeLabel="Note"
        isCreating={isCreating}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        itemCounts={itemCounts}
      />

      <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 overflow-hidden bg-gray-700">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Trigger */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden text-gray-400 hover:text-white p-1 rounded-md hover:bg-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex flex-col">
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-200 flex items-center space-x-3">
                <span>{currentFile ? currentFile.split('/').pop() : "No Note Selected"}</span>
              </h2>
            </div>

            {isSaving && (
              <div className="flex items-center space-x-2 text-blue-400 ml-4">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm font-normal">Saving...</span>
              </div>
            )}



            {/* Discussion Toggle */}
            {roomId && currentFile && (
              <button
                onClick={() => setIsDiscussionOpen(!isDiscussionOpen)}
                className={`p-2 rounded-lg relative ${isDiscussionOpen ? 'text-blue-400 bg-blue-400/10' : 'text-gray-400 hover:text-blue-400 hover:bg-blue-400/10'}`}
                title={isDiscussionOpen ? "Close Discussion" : "Open Discussion"}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {itemCounts[currentFile] > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white ring-2 ring-gray-900">
                    {itemCounts[currentFile] > 99 ? '99+' : itemCounts[currentFile]}
                  </span>
                )}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Full Screen Toggle */}
            {currentFile && (
              <button
                onClick={() => setIsFullScreen(true)}
                className="p-2 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-400/10"
                title="Full Screen"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4h4 M20 8V4h-4 M4 16v4h4 M20 16v4h-4" />
                </svg>
              </button>
            )}

            {roomId && (
              <div className="bg-blue-600/20 text-blue-300 px-3 py-1 rounded-full text-sm font-medium border border-blue-600/30">
                Room Notes
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          {currentFile ? (
            <div className="flex-1 flex flex-col min-h-0 gap-4">
              <div
                className={`
 flex flex-col overflow-hidden 
 ${isFullScreen
                    ? "fixed inset-0 z-[100] bg-gray-900 w-full h-full p-0 border-none rounded-none"
                    : "flex-1 bg-gray-800/50 backdrop-blur-sm border border-gray-600/50 rounded-xl shadow-lg p-3 sm:p-4"
                  }
`}
              >
                {isFullScreen && (
                  <button
                    onClick={() => setIsFullScreen(false)}
                    className="absolute top-2 right-2 z-[110] p-2 bg-gray-800 text-white rounded-lg border border-gray-600 shadow-xl hover:bg-gray-700"
                    title="Exit Full Screen"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}

                {roomId && supabaseNotes?.find(n => n.title === currentFile)?.is_collaborative ? (
                  <CollabEditor
                    roomId={roomId}
                    fileName={currentFile}
                    initialContent={text}
                    onUpdate={handleTextUpdate}
                    isFullScreen={isFullScreen}
                    key={currentFile}
                  />
                ) : (
                  <Editor content={text} onUpdate={handleTextUpdate} isFullScreen={isFullScreen} key={currentFile} />
                )}
              </div>

              {roomId && isDiscussionOpen && (
                <div className="h-72 bg-gray-800/50 backdrop-blur-sm border border-gray-600/50 rounded-xl shadow-lg overflow-hidden flex flex-col">
                  <ItemDiscussion itemId={currentFile} itemType="note" roomId={roomId} />
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <p className="text-lg mb-2">No note selected</p>
                <p className="text-sm opacity-75">
                  {Object.keys(files).length === 0 && isDecrypting
                    ? "Decrypting your notes..."
                    : Object.keys(files).length === 0
                      ? "Create your first note to get started"
                      : "Select a note from the sidebar to begin editing"
                  }
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}