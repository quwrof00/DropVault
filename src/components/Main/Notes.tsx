import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase-client";
import { useAuthUser } from "../../hooks/useAuthUser";
import { useNavigate } from "react-router-dom";
import Editor from "../Editor/Editor";
import CollabEditor from "../CollabEditor";
import { encrypt } from "../../lib/crypto-helper";
import SubSidebar from "../PageHelpers/SubSidebar";
import { Dialog, type DialogProps } from "../UI/Dialog";
import ItemDiscussion from "./ItemDiscussion";
import { useItemCounts } from "../../hooks/useItemCounts";

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
}

export default function Notes({ roomId }: NotesProps) {
  const user = useAuthUser() as User | null | undefined;
  const navigate = useNavigate();

  const [files, setFiles] = useState<{ [key: string]: string }>({});
  const [currentFile, setCurrentFile] = useState<string>("");

  const [text, setText] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const [decryptProgress, setDecryptProgress] = useState<number>(0);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Partial<DialogProps> & { isOpen: boolean }>({ isOpen: false, title: "" });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDiscussionOpen, setIsDiscussionOpen] = useState(false);

  // Real-time comment counts
  const itemCounts = useItemCounts(roomId, 'note');

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const lastSavedTextRef = useRef<string>("");
  const isInitialLoadRef = useRef(true);



  // Debounced save function for notes (personal or room)
  const saveNote = useCallback(async (fileName: string, content: string, forceImmediate = false) => {
    if (!user || !fileName || !isMountedRef.current) return;

    if (!forceImmediate && content === lastSavedTextRef.current) return;

    console.log(`Saving note: ${fileName}`);

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
            user_id: null // Explicitly null for room notes if needed, or omit if default
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

      lastSavedTextRef.current = content;
      setFiles(prev => ({ ...prev, [fileName]: content }));
      console.log(`Successfully saved: ${fileName}`);

      if (isMountedRef.current) {
        setError(null);
      }
    } catch (err) {
      console.error("Save failed:", err);
      if (isMountedRef.current) {
        setError("Failed to save note. Changes may be lost.");
      }
    } finally {
      if (isMountedRef.current) {
        setIsSaving(false);
      }
    }
  }, [user, roomId]);

  // Worker ref
  const decryptWorkerRef = useRef<Worker | null>(null);

  // Fetch notes (personal or room notes) - Worker Implementation
  const fetchNotes = useCallback(async () => {
    if (user === undefined) return;

    if (!user) {
      navigate("/login");
      return;
    }

    setIsLoading(true);
    setDecryptProgress(0);
    setError(null);

    // Terminate existing worker if any
    if (decryptWorkerRef.current) {
      decryptWorkerRef.current.terminate();
    }

    // Initialize new worker
    const worker = new Worker(new URL('../../workers/decryptWorker.ts', import.meta.url), {
      type: 'module'
    });
    decryptWorkerRef.current = worker;

    try {
      const secretKey = roomId ?? user.id;

      // ---------------------------------------------------------
      // 1. Fetch Supabase notes ordered by updated_at DESC
      // ---------------------------------------------------------
      let query = supabase
        .from("notes")
        .select("title, ciphertext, iv, salt, updated_at");

      if (roomId) {
        query = query.eq("room_id", roomId);
      } else {
        query = query.eq("user_id", user.id).is("room_id", null);
      }

      query = query.order("updated_at", { ascending: false });

      const {
        data: supabaseData,
        error,
      }: { data: NoteRow[] | null; error: unknown } = await query;

      if (error) {
        console.error("Failed to fetch Supabase notes", error);
        setError("Failed to load notes. Please try again.");
        setFiles({});
        setIsLoading(false);
        return;
      }

      if (!supabaseData || supabaseData.length === 0) {
        setFiles({});
        setIsLoading(false);
        setCurrentFile("");
        setText("");
        lastSavedTextRef.current = "";
        return;
      }

      // Notes fetched, now start "Decrypting" phase
      // We set isLoading to false so the UI can render immediately (empty list first)
      // And set isDecrypting to true to show progress
      setIsLoading(false);
      setIsDecrypting(true);

      // ---------------------------------------------------------
      // 2. Offload Decryption to Worker
      // ---------------------------------------------------------

      // Temporary storage to help determine "first file"
      let firstDecrypted = false;

      worker.onmessage = (e) => {
        const { type, payload, progress } = e.data;

        if (type === 'batch') {
          // Update progress
          if (typeof progress === 'number') {
            setDecryptProgress(Math.round(progress * 100));
          }

          // payload is an array of { title, content }
          const batchResults: Record<string, string> = {};
          payload.forEach((item: { title: string; content: string }) => {
            batchResults[item.title] = item.content;
          });

          setFiles(prev => ({
            ...prev,
            ...batchResults
          }));

          // Logic to open the first file automatically (if not already selected)
          // We iterate through the batch to see if we found a candidate
          if (!firstDecrypted && !currentFile) {
            const candidate = payload.find((p: { title: string }) => !p.title.endsWith("/.placeholder"));
            if (candidate) {
              firstDecrypted = true;
              setCurrentFile(candidate.title);
              setText(candidate.content);
              lastSavedTextRef.current = candidate.content;
            }
          }

          // If the currently open file is in this batch, refresh it (e.g. initial load overwrite)
          if (currentFile && batchResults[currentFile] !== undefined) {
            setText(batchResults[currentFile]);
            lastSavedTextRef.current = batchResults[currentFile];
          }
        }
        else if (type === 'done') {
          setIsDecrypting(false);
          setDecryptProgress(100);
          isInitialLoadRef.current = false;
        }
      };

      worker.onerror = (err) => {
        console.error("Worker error:", err);
        setError("Error decrypting notes.");
        setIsDecrypting(false);
        setIsLoading(false);
      };

      // Feed chunks to worker
      worker.postMessage({ notes: supabaseData, secretKey });

    } catch (err) {
      console.error("Error loading notes:", err);
      if (isMountedRef.current) {
        setError("An unexpected error occurred while loading notes.");
        setIsLoading(false);
        setIsDecrypting(false); // Ensure decrypting is false on error
      }
    }
  }, [user, navigate, roomId, currentFile]);

  useEffect(() => {
    fetchNotes();
  }, [user, roomId, navigate]);

  // Note autosave
  useEffect(() => {
    if (!user || !currentFile || isInitialLoadRef.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && text !== lastSavedTextRef.current) {
        saveNote(currentFile, text).catch(console.error);
      }
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [currentFile, user, text, roomId, saveNote]);

  // Save on visibility change and unload
  useEffect(() => {
    if (!user) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && currentFile && text !== lastSavedTextRef.current) {
        saveNote(currentFile, text, true).catch(console.error);
      }
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (currentFile && text !== lastSavedTextRef.current) {
        saveNote(currentFile, text, true).catch(console.error);
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
  }, [user, roomId, currentFile, text, saveNote]);

  // Component cleanup
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      if (decryptWorkerRef.current) {
        decryptWorkerRef.current.terminate();
      }

      if (user && currentFile && text !== lastSavedTextRef.current) {
        saveNote(currentFile, text, true).catch(console.error);
      }
    };
  }, [user, roomId, currentFile, text, saveNote]);

  const handleFileSelect = useCallback((file: string) => {
    if (currentFile && text !== lastSavedTextRef.current) {
      saveNote(currentFile, text, true).catch(console.error);
    }

    setCurrentFile(file);
    setText(files[file] || "");
    lastSavedTextRef.current = files[file] || "";
    setError(null);
  }, [roomId, currentFile, text, files, saveNote]);

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
          showAlert("Folder name cannot contain '/'");
          return;
        }

        const fullPath = trimmedName;
        const folderExists = Object.keys(files).some(path =>
          path === fullPath || path.startsWith(fullPath + "/")
        );

        if (folderExists) {
          showAlert(`Folder "${trimmedName}" already exists!`);
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
      onConfirm: async (name) => {
        if (!name?.trim()) return;
        const trimmedName = name.trim();

        if (files[trimmedName]) {
          showAlert(`Note with title "${trimmedName}" already exists!`);
          return;
        }

        setIsCreating(true);
        try {
          const secretKey = roomId ?? user.id;
          const encrypted = await encrypt("", secretKey);
          const { error } = await supabase.from("notes").insert({
            user_id: roomId ? null : user.id,
            room_id: roomId ?? null,
            title: trimmedName,
            ciphertext: encrypted.ciphertext,
            iv: encrypted.iv,
            salt: encrypted.salt,
          });

          if (error) throw error;
          setFiles((prev) => ({ ...prev, [trimmedName]: "" }));
          setCurrentFile(trimmedName);
          setText("");
          lastSavedTextRef.current = "";
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
      message: `Are you sure you want to delete "${itemName}"?${isFolder ? ' This will delete all notes inside.' : ''}`,
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

            if (currentFile.startsWith(file + '/')) {
              setCurrentFile("");
              setText("");
              lastSavedTextRef.current = "";
            }
          } else {
            const deleteQuery = supabase.from("notes").delete().eq("title", file);
            if (roomId) deleteQuery.eq("room_id", roomId);
            else deleteQuery.is("room_id", null).eq("user_id", user.id);

            const { error } = await deleteQuery;
            if (error) throw error;

            setFiles(prev => {
              const updated = { ...prev };
              delete updated[file];
              return updated;
            });

            if (file === currentFile) {
              setCurrentFile("");
              setText("");
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
          showAlert("Name cannot contain '/' character");
          return;
        }

        const pathParts = file.split('/');
        pathParts[pathParts.length - 1] = trimmedName;
        const newPath = pathParts.join('/');

        if (files[newPath]) {
          showAlert(`A ${isFolder ? 'folder' : 'note'} with name "${trimmedName}" already exists!`);
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
              setCurrentFile(currentFile.replace(file, newPath));
            }
          } else {
            const updateQuery = supabase.from("notes").update({ title: newPath }).eq("title", file);
            if (roomId) updateQuery.eq("room_id", roomId);
            else updateQuery.is("room_id", null).eq("user_id", user.id);
            const { error } = await updateQuery;
            if (error) throw error;

            setFiles(prev => {
              const updated = { ...prev };
              delete updated[file];
              updated[newPath] = files[file]; // Keep content
              return updated;
            });

            if (file === currentFile) {
              setCurrentFile(newPath);
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
  }, []);

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
    <div className="flex flex-col md:flex-row h-full bg-gray-700 rounded-lg shadow-lg overflow-hidden transition-all duration-300 relative">
      {error && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2 animate-slideDown">
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-2 text-red-200 hover:text-white transition-colors">✕</button>
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

      <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 overflow-hidden bg-gray-700 transition-all duration-300">
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
              {isDecrypting && (
                <div className="flex items-center space-x-2 mt-1">
                  <div className="w-24 h-1.5 bg-gray-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-400 transition-all duration-300 ease-out"
                      style={{ width: `${decryptProgress}%` }}
                    />
                  </div>
                  <span className="text-xs text-blue-300 font-medium">{decryptProgress}% Decrypted</span>
                </div>
              )}
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
                className={`ml-3 p-2 rounded-lg transition-all duration-200 relative ${isDiscussionOpen ? 'text-blue-400 bg-blue-400/10' : 'text-gray-400 hover:text-blue-400 hover:bg-blue-400/10'}`}
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

          {roomId && (
            <div className="bg-blue-600/20 text-blue-300 px-3 py-1 rounded-full text-sm font-medium border border-blue-600/30">
              Room Notes
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          {currentFile ? (
            <div className="flex-1 flex flex-col min-h-0 gap-4">
              <div className="flex-1 bg-gray-800/50 backdrop-blur-sm border border-gray-600/50 rounded-xl shadow-lg p-3 sm:p-4 overflow-hidden flex flex-col">
                {roomId ? (
                  <CollabEditor
                    roomId={roomId}
                    fileName={currentFile}
                    initialContent={text}
                    onUpdate={handleTextUpdate}
                    key={currentFile}
                  />
                ) : (
                  <Editor content={text} onUpdate={handleTextUpdate} key={currentFile} />
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