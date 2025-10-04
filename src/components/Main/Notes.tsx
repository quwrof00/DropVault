import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase-client";
import { useAuthUser } from "../../hooks/useAuthUser";
import { useNavigate } from "react-router-dom";
import Editor from "../Editor/Editor";
import CollabEditor from "../CollabEditor";
import { encrypt, decrypt } from "../../lib/crypto-helper";
import SubSidebar from "../PageHelpers/SubSidebar";

interface User {
  id: string;
}

interface Note {
  user_id: string;
  title: string;
  room_id: string | null;
  ciphertext: string;
  iv: string;
  salt: string;
  updated_at: string;
}

type NotesProps = {
  roomId?: string | null;
};

export default function Notes({ roomId }: NotesProps) {
  const user = useAuthUser() as User | null | undefined;
  const navigate = useNavigate();

  const [files, setFiles] = useState<{ [key: string]: string }>({});
  const [currentFile, setCurrentFile] = useState<string>("");
  const [text, setText] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for managing save state and cleanup
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const lastSavedTextRef = useRef<string>("");
  const isInitialLoadRef = useRef(true);

  // Debounced save function for personal notes
  const savePersonalNote = useCallback(async (fileName: string, content: string, forceImmediate = false) => {
    if (!user || roomId || !fileName || !isMountedRef.current) return;
    
    // Skip save if content hasn't changed
    if (!forceImmediate && content === lastSavedTextRef.current) return;

    console.log(`Saving personal note: ${fileName}`);

    try {
      setIsSaving(true);
      const secretKey = user.id;
      const encrypted = await encrypt(content, secretKey);
      
      const { error } = await supabase
        .from("notes")
        .upsert(
          { 
            user_id: user.id, 
            title: fileName, 
            ciphertext: encrypted.ciphertext, 
            iv: encrypted.iv, 
            salt: encrypted.salt, 
            room_id: null 
          },
          { onConflict: "user_id,title" }
        );
        
      if (error) throw error;
      
      lastSavedTextRef.current = content;
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

  // Fetch notes (personal or room notes)
  const fetchNotes = useCallback(async () => {
    if (user === undefined) return;
    if (!user) {
      navigate("/login");
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const secretKey = roomId ?? user.id;
      let query = supabase
        .from("notes")
        .select("title, ciphertext, iv, salt, updated_at");

      if (roomId) {
        query = query.eq("room_id", roomId);
      } else {
        query = query.eq("user_id", user.id).is("room_id", null);
      }

      query = query.order("updated_at", { ascending: false });
      const { data: supabaseData, error } = await query;

      if (error) {
        console.error("Failed to fetch Supabase notes", error);
        setError("Failed to load notes. Please try again.");
        setFiles({});
        return;
      }

      const supabaseNotes: { [key: string]: string } = {};
      for (const note of supabaseData ?? []) {
        const { title, ciphertext, iv, salt } = note as Note;
        try {
          supabaseNotes[title] = ciphertext && iv && salt
            ? await decrypt({ ciphertext, iv, salt }, secretKey)
            : "";
        } catch (decryptError) {
          console.error(`Failed to decrypt note: ${title}`, decryptError);
          supabaseNotes[title] = "[Decryption failed - please check your access permissions]";
        }
      }

      if (!isMountedRef.current) return;

      setFiles(supabaseNotes);
      
      // Set current file if none selected or if current file doesn't exist
      if (!currentFile || !(currentFile in supabaseNotes)) {
        const firstFile = Object.keys(supabaseNotes)[0];
        if (firstFile) {
          setCurrentFile(firstFile);
          setText(supabaseNotes[firstFile]);
          lastSavedTextRef.current = supabaseNotes[firstFile];
        } else {
          setCurrentFile("");
          setText("");
          lastSavedTextRef.current = "";
        }
      } else {
        // Update text if current file exists but content changed
        const updatedContent = supabaseNotes[currentFile];
        if (updatedContent !== undefined) {
          setText(updatedContent);
          lastSavedTextRef.current = updatedContent;
        }
      }
    } catch (err) {
      console.error("Error loading notes:", err);
      if (isMountedRef.current) {
        setError("An unexpected error occurred while loading notes.");
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        isInitialLoadRef.current = false;
      }
    }
  }, [user, navigate, roomId, currentFile]);

  // Initial fetch
  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Personal note autosave (skip room notes as they're handled by CollabEditor)
  useEffect(() => {
    if (!user || !currentFile || roomId || isInitialLoadRef.current) return;
    console.log("Notes check for room");
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounced save
    saveTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && text !== lastSavedTextRef.current) {
        savePersonalNote(currentFile, text).catch(console.error);
      }
    }, 2000); // 2 second debounce

    // Cleanup function
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [currentFile, user, text, roomId, savePersonalNote]);

  // Save on visibility change and unload for personal notes
  useEffect(() => {
    if (!user || roomId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && currentFile && text !== lastSavedTextRef.current) {
        savePersonalNote(currentFile, text, true).catch(console.error);
      }
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (currentFile && text !== lastSavedTextRef.current) {
        // For immediate save on unload
        savePersonalNote(currentFile, text, true).catch(console.error);
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
  }, [user, roomId, currentFile, text, savePersonalNote]);

  // Component cleanup
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      
      // Clear any pending saves
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      // Final save attempt for personal notes
      if (user && !roomId && currentFile && text !== lastSavedTextRef.current) {
        savePersonalNote(currentFile, text, true).catch(console.error);
      }
    };
  }, [user, roomId, currentFile, text, savePersonalNote]);

  const handleFileSelect = useCallback((file: string) => {
    // Save current file before switching (for personal notes only)
    if (!roomId && currentFile && text !== lastSavedTextRef.current) {
      savePersonalNote(currentFile, text, true).catch(console.error);
    }
    
    setCurrentFile(file);
    setText(files[file] || "");
    lastSavedTextRef.current = files[file] || "";
    setError(null);
  }, [roomId, currentFile, text, files, savePersonalNote]);

const handleNewFile = useCallback(async () => {
  if (!user) return;

  const name = prompt("Enter a name for your note:");
  if (!name || !name.trim()) return;

  const trimmedName = name.trim();
  if (files[trimmedName]) {
    alert(`Note with title "${trimmedName}" already exists!`);
    return;
  }

  setIsCreating(true);
  try {
    const secretKey = roomId ?? user.id;
    const encrypted = await encrypt("", secretKey);

    const { error } = await supabase.from("notes").insert({
      user_id: roomId ? null : user.id,    // ✅ only set for personal notes
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
    setError(null);
  } catch (err) {
    console.error("Error creating note:", err);
    alert("Failed to create note. Please try again.");
  } finally {
    setIsCreating(false);
  }
}, [user, roomId, files]);

const handleDelete = useCallback(async (file: string) => {
  if (!user || !confirm(`Delete "${file}"?`)) return;

  try {
    const deleteQuery = supabase.from("notes").delete().eq("title", file);

    if (roomId) {
      deleteQuery.eq("room_id", roomId);                       // ✅ room-scoped
    } else {
      deleteQuery.is("room_id", null).eq("user_id", user.id);  // ✅ personal
    }

    const { error } = await deleteQuery;
    if (error) throw error;

    const updated = { ...files };
    delete updated[file];
    setFiles(updated);

    if (file === currentFile) {
      const next = Object.keys(updated)[0] || "";
      setCurrentFile(next);
      setText(updated[next] || "");
      lastSavedTextRef.current = updated[next] || "";
    }

    setError(null);
  } catch (err) {
    console.error("Delete failed:", err);
    alert(`Failed to delete note "${file}". Please try again.`);
  }
}, [user, roomId, files, currentFile]);

const handleRename = useCallback(async (file: string) => {
  if (!user) return;

  const newName = prompt("Enter new title:", file);
  if (!newName || !newName.trim() || newName.trim() === file) return;

  const trimmedName = newName.trim();
  if (files[trimmedName]) {
    alert(`Note with title "${trimmedName}" already exists!`);
    return;
  }

  try {
    const updateQuery = supabase
      .from("notes")
      .update({ title: trimmedName })
      .eq("title", file);

    if (roomId) {
      updateQuery.eq("room_id", roomId);                        // ✅ room-scoped
    } else {
      updateQuery.is("room_id", null).eq("user_id", user.id);   // ✅ personal
    }

    const { error } = await updateQuery;
    if (error) throw error;

    setFiles((prev) => {
      const updated: { [key: string]: string } = {};
      Object.keys(prev).forEach((key) => {
        updated[key === file ? trimmedName : key] = prev[key];
      });
      return updated;
    });

    if (file === currentFile) {
      setCurrentFile(trimmedName);
    }

    setError(null);
  } catch (err) {
    console.error("Rename failed:", err);
    alert(`Failed to rename note "${file}". Please try again.`);
  }
}, [user, roomId, files, currentFile]);

  const handleTextUpdate = useCallback((newText: string) => {
    setText(newText);
    // lastSavedTextRef will be updated by the save function
  }, []);

  const filteredFiles = Object.keys(files)
    .filter((file) => file.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

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
    <div className="flex h-[calc(100vh-4rem)] bg-gray-700 rounded-lg shadow-lg overflow-hidden transition-all duration-300">
      {error && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2 animate-slideDown">
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-2 text-red-200 hover:text-white transition-colors">✕</button>
        </div>
      )}

      <SubSidebar
        search={search}
        setSearch={setSearch}
        items={filteredFiles}
        onCreate={handleNewFile}
        onSelect={handleFileSelect}
        onRename={handleRename}
        onDelete={handleDelete}
        currentItem={currentFile}
        typeLabel="Note"
        isCreating={isCreating}
      />

      <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 overflow-hidden bg-gray-700 transition-all duration-300">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-200 flex items-center space-x-3">
            <span>{currentFile || "No Note Selected"}</span>
            {isSaving && !roomId && (
              <div className="flex items-center space-x-2 text-blue-400">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm font-normal">Saving...</span>
              </div>
            )}
          </h2>

          {roomId && (
            <div className="bg-blue-600/20 text-blue-300 px-3 py-1 rounded-full text-sm font-medium border border-blue-600/30">
              Room Notes
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          {currentFile ? (
            <div className="flex-1 bg-gray-800/50 backdrop-blur-sm border border-gray-600/50 rounded-xl shadow-lg p-3 sm:p-4 overflow-auto">
              {roomId ? (
                <CollabEditor roomId={roomId} user={user!} currentFile={currentFile} />
              ) : (
                <Editor content={text} onUpdate={handleTextUpdate} key={currentFile} />
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <p className="text-lg mb-2">No note selected</p>
                <p className="text-sm opacity-75">
                  {Object.keys(files).length === 0 
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