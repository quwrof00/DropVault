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

// interface Note {
//   user_id: string;
//   title: string;
//   room_id: string | null;
//   ciphertext: string;
//   iv: string;
//   salt: string;
//   updated_at: string;
// }

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
  const [currentFolder, setCurrentFolder] = useState<string>("");
  const [text, setText] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const lastSavedTextRef = useRef<string>("");
  const isInitialLoadRef = useRef(true);

  // Helper to get full path for a new file in current folder
  const getFullPath = useCallback((fileName: string) => {
    return currentFolder ? `${currentFolder}/${fileName}` : fileName;
  }, [currentFolder]);

  // Debounced save function for personal notes
  const savePersonalNote = useCallback(async (fileName: string, content: string, forceImmediate = false) => {
    if (!user || roomId || !fileName || !isMountedRef.current) return;
    
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
      return;
    }

    // ---------------------------------------------------------
    // 2. Decrypt notes into local object
    // ---------------------------------------------------------
    const supabaseNotes: Record<string, string> = {};

    for (const note of supabaseData ?? []) {
      const { title, ciphertext, iv, salt } = note;

      try {
        supabaseNotes[title] =
          ciphertext && iv && salt
            ? await decrypt({ ciphertext, iv, salt }, secretKey)
            : "";
      } catch (err) {
        console.error("Decrypt failed for:", title, err);
        supabaseNotes[title] =
          "[Decryption failed - please check your access permissions]";
      }
    }

    if (!isMountedRef.current) return;

    setFiles(supabaseNotes);

    // ---------------------------------------------------------
    // 3. Determine which file to open
    // ---------------------------------------------------------

    const currentExists =
      currentFile && supabaseNotes[currentFile] !== undefined;

    // A. If current file does not exist → pick newest real file
    if (!currentExists) {
      const firstFile = (supabaseData ?? [])
        .map((n) => n.title)
        .find((title) => !title.endsWith("/.placeholder"));

      if (firstFile) {
        setCurrentFile(firstFile);
        setText(supabaseNotes[firstFile]);
        lastSavedTextRef.current = supabaseNotes[firstFile];
      } else {
        // No files at all
        setCurrentFile("");
        setText("");
        lastSavedTextRef.current = "";
      }
    } else {
      // B. File exists → refresh its content
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
}, [user, navigate, roomId]);



  useEffect(() => {
    fetchNotes();
  }, [user, roomId, navigate]);

  // Personal note autosave
  useEffect(() => {
    if (!user || !currentFile || roomId || isInitialLoadRef.current) return;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && text !== lastSavedTextRef.current) {
        savePersonalNote(currentFile, text).catch(console.error);
      }
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [currentFile, user, text, roomId, savePersonalNote]);

  // Save on visibility change and unload
  useEffect(() => {
    if (!user || roomId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && currentFile && text !== lastSavedTextRef.current) {
        savePersonalNote(currentFile, text, true).catch(console.error);
      }
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (currentFile && text !== lastSavedTextRef.current) {
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
      
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      if (user && !roomId && currentFile && text !== lastSavedTextRef.current) {
        savePersonalNote(currentFile, text, true).catch(console.error);
      }
    };
  }, [user, roomId, currentFile, text, savePersonalNote]);

  const handleFileSelect = useCallback((file: string) => {
    if (!roomId && currentFile && text !== lastSavedTextRef.current) {
      savePersonalNote(currentFile, text, true).catch(console.error);
    }
    
    setCurrentFile(file);
    setText(files[file] || "");
    lastSavedTextRef.current = files[file] || "";
    setError(null);
  }, [roomId, currentFile, text, files, savePersonalNote]);

  const handleNewFolder = useCallback(async () => {
  if (!user) return;

  const name = prompt("Enter folder name:");
  if (!name?.trim()) return;

  const trimmedName = name.trim();

  if (trimmedName.includes("/")) {
    alert("Folder name cannot contain '/'");
    return;
  }

  const fullPath = getFullPath(trimmedName);

  // Folder exists check (stronger)
  const folderExists = Object.keys(files).some(path =>
    path === fullPath || path.startsWith(fullPath + "/")
  );

  if (folderExists) {
    alert(`Folder "${trimmedName}" already exists!`);
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
    setError(null);
  } catch (err) {
    console.error("Error creating folder:", err);
    alert("Failed to create folder. Please try again.");
  }
}, [user, roomId, files, getFullPath]);


  const handleNewFile = useCallback(async () => {
    if (!user) return;

    const name = prompt("Enter a name for your note:");
    if (!name || !name.trim()) return;

    const trimmedName = name.trim();

    const fullPath = getFullPath(trimmedName);

    if (files[fullPath]) {
      alert(`Note with title "${trimmedName}" already exists!`);
      return;
    }

    setIsCreating(true);
    try {
      const secretKey = roomId ?? user.id;
      const encrypted = await encrypt("", secretKey);

      const { error } = await supabase.from("notes").insert({
        user_id: roomId ? null : user.id,
        room_id: roomId ?? null,
        title: fullPath,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        salt: encrypted.salt,
      });

      if (error) throw error;

      setFiles((prev) => ({ ...prev, [fullPath]: "" }));
      setCurrentFile(fullPath);
      setText("");
      lastSavedTextRef.current = "";
      setError(null);
    } catch (err) {
      console.error("Error creating note:", err);
      alert("Failed to create note. Please try again.");
    } finally {
      setIsCreating(false);
    }
  }, [user, roomId, files, getFullPath]);

  const handleDelete = useCallback(async (file: string) => {
    if (!user) return;

    // Check if it's a folder by seeing if any files start with this path + /
    const isFolder = Object.keys(files).some(path => 
      path !== file && path.startsWith(file + '/')
    );
    
    const itemName = file.split('/').pop() || file;

    if (!confirm(`Delete ${isFolder ? 'folder' : 'note'} "${itemName}"?${isFolder ? ' This will delete all notes inside.' : ''}`)) {
      return;
    }

    try {
      if (isFolder) {
        // Delete all files in the folder
        const filesToDelete = Object.keys(files).filter(path => path.startsWith(file + '/'));
        
        for (const path of filesToDelete) {
          const deleteQuery = supabase.from("notes").delete().eq("title", path);

          if (roomId) {
            deleteQuery.eq("room_id", roomId);
          } else {
            deleteQuery.is("room_id", null).eq("user_id", user.id);
          }

          const { error } = await deleteQuery;
          if (error) throw error;
        }

        const updated = { ...files };
        filesToDelete.forEach(path => delete updated[path]);
        setFiles(updated);

        // If current file was in deleted folder, clear selection
        if (currentFile.startsWith(file + '/')) {
          const next = Object.keys(updated).find(key => !key.endsWith('/.placeholder')) || "";
          setCurrentFile(next);
          setText(updated[next] || "");
          lastSavedTextRef.current = updated[next] || "";
        }
      } else {
        // Delete single file
        const deleteQuery = supabase.from("notes").delete().eq("title", file);

        if (roomId) {
          deleteQuery.eq("room_id", roomId);
        } else {
          deleteQuery.is("room_id", null).eq("user_id", user.id);
        }

        const { error } = await deleteQuery;
        if (error) throw error;

        const updated = { ...files };
        delete updated[file];
        setFiles(updated);

        if (file === currentFile) {
          const next = Object.keys(updated).find(key => !key.endsWith('/.placeholder')) || "";
          setCurrentFile(next);
          setText(updated[next] || "");
          lastSavedTextRef.current = updated[next] || "";
        }
      }

      setError(null);
    } catch (err) {
      console.error("Delete failed:", err);
      alert(`Failed to delete. Please try again.`);
    }
  }, [user, roomId, files, currentFile]);

  const handleRename = useCallback(async (file: string) => {
    if (!user) return;

    // Check if it's a folder
    const isFolder = Object.keys(files).some(path => 
      path !== file && path.startsWith(file + '/')
    );
    
    const oldName = file.split('/').pop() || file;
    const newName = prompt(`Enter new name for ${isFolder ? 'folder' : 'note'}:`, oldName);
    
    if (!newName || !newName.trim() || newName.trim() === oldName) return;

    const trimmedName = newName.trim();
    
    if (trimmedName.includes('/')) {
      alert("Name cannot contain '/' character");
      return;
    }

    const pathParts = file.split('/');
    pathParts[pathParts.length - 1] = trimmedName;
    const newPath = pathParts.join('/');

    if (files[newPath]) {
      alert(`A ${isFolder ? 'folder' : 'note'} with name "${trimmedName}" already exists!`);
      return;
    }

    try {
      if (isFolder) {
        // Rename folder and all its contents
        const itemsToRename = Object.keys(files).filter(path => path.startsWith(file + '/'));
        
        for (const path of itemsToRename) {
          const newItemPath = path.replace(file, newPath);
          const updateQuery = supabase
            .from("notes")
            .update({ title: newItemPath })
            .eq("title", path);

          if (roomId) {
            updateQuery.eq("room_id", roomId);
          } else {
            updateQuery.is("room_id", null).eq("user_id", user.id);
          }

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
        // Rename single file
        const updateQuery = supabase
          .from("notes")
          .update({ title: newPath })
          .eq("title", file);

        if (roomId) {
          updateQuery.eq("room_id", roomId);
        } else {
          updateQuery.is("room_id", null).eq("user_id", user.id);
        }

        const { error } = await updateQuery;
        if (error) throw error;

        setFiles((prev) => {
          const updated: { [key: string]: string } = {};
          Object.keys(prev).forEach((key) => {
            updated[key === file ? newPath : key] = prev[key];
          });
          return updated;
        });

        if (file === currentFile) {
          setCurrentFile(newPath);
        }
      }

      setError(null);
    } catch (err) {
      console.error("Rename failed:", err);
      alert(`Failed to rename. Please try again.`);
    }
  }, [user, roomId, files, currentFile]);

  const handleTextUpdate = useCallback((newText: string) => {
    setText(newText);
  }, []);

  // Get all file paths (excluding placeholders) for SubSidebar to build tree
  const allFilePaths = Object.keys(files);

// Folders = entries ending with /.placeholder (strip the placeholder)
// const folderPaths = allFilePaths
//   .filter(path => path.endsWith('/.placeholder'))
//   .map(path => path.replace('/.placeholder', ''));

// // Files = everything except placeholder entries
// const filePaths = allFilePaths
//   .filter(path => !path.endsWith('/.placeholder'));


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
        items={allFilePaths}
        onCreate={handleNewFile}
        onCreateFolder={handleNewFolder}
        onSelect={handleFileSelect}
        onRename={handleRename}
        onDelete={handleDelete}
        currentItem={currentFile}
        typeLabel="Note"
        isCreating={isCreating}
        currentFolder={currentFolder}
        onFolderChange={setCurrentFolder}
      />

      <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 overflow-hidden bg-gray-700 transition-all duration-300">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-200 flex items-center space-x-3">
            <span>{currentFile ? currentFile.split('/').pop() : "No Note Selected"}</span>
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