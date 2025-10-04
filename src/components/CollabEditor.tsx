import { useEffect, useRef, useState, useCallback } from "react";
import * as Y from "yjs";
import { io, Socket } from "socket.io-client";
import { supabase } from "../lib/supabase-client";
import { debounce } from "lodash";

interface User {
  id: string;
}

interface CollabEditorProps {
  roomId: string;
  currentFile: string;
  user: User | null;
}

interface ServerToClientEvents {
  "yjs-update": (data: { update: number[]; fileName: string }) => void;
  "request-sync": (data: { requester: string; fileName: string }) => void;
  "save-final": (data: { roomId: string; fileName: string }) => void;
  "file-sync-response": (data: { fileName: string; update: number[] }) => void;
}

interface ClientToServerEvents {
  "join-file": (data: { roomId: string; fileName: string }) => void;
  "leave-file": (data: { roomId: string; fileName: string }) => void;
  "yjs-update": (data: { roomId: string; fileName: string; update: number[] }) => void;
  "reply-sync": (data: { to: string; fileName: string; update: number[] }) => void;
  "request-file-sync": (data: { roomId: string; fileName: string }) => void;
}

interface Note {
  title: string;
  room_id: string | null;
  content: string;
}

const SERVER_URL = "http://localhost:8000";

export default function CollabEditor({ roomId, currentFile }: CollabEditorProps) {
  const [text, setText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  const ydocRef = useRef<Y.Doc | null>(null);
  const ytextRef = useRef<Y.Text | null>(null);
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLoadedRef = useRef(false);
  const isMountedRef = useRef(true);
  const currentFileRef = useRef(currentFile);
  const isUpdatingFromRemoteRef = useRef(false);
  const lastSavedContentRef = useRef<string>("");
  const savePromiseRef = useRef<Promise<void> | null>(null);
  const noteIdCacheRef = useRef<Map<string, string>>(new Map()); // Cache note IDs

  // Update current file ref when prop changes
  useEffect(() => {
    currentFileRef.current = currentFile;
  }, [currentFile]);

  // Validate note data
  const isValidNote = (data: any): data is Note => {
    return (
      typeof data.title === "string" &&
      (typeof data.room_id === "string" || data.room_id === null) &&
      typeof data.content === "string"
    );
  };

  // Helper: find note id by title + room_id with caching
  const findNoteId = useCallback(async (fileName: string): Promise<string | null> => {
    const cacheKey = `${roomId}:${fileName}`;
    
    // Check cache first
    if (noteIdCacheRef.current.has(cacheKey)) {
      return noteIdCacheRef.current.get(cacheKey) || null;
    }

    try {
      const { data, error } = await supabase
        .from("notes")
        .select("id")
        .eq("title", fileName)
        .eq("room_id", roomId)
        .maybeSingle();

      if (error) throw error;
      
      const noteId = (data as { id: string } | null)?.id ?? null;
      
      // Cache the result
      if (noteId) {
        noteIdCacheRef.current.set(cacheKey, noteId);
      }
      
      return noteId;
    } catch (err) {
      console.error("findNoteId failed:", err);
      return null;
    }
  }, [roomId]);

  // Improved saveDoc with better error handling and caching
const saveDoc = useCallback(async (fileName?: string, forceImmediate = false): Promise<void> => {
  const ytext = ytextRef.current;
  const fileToSave = fileName || currentFileRef.current;

  if (!ytext || !isMountedRef.current || !fileToSave) return;

  const currentContent = ytext.toString();

  // Prevent saving empty content
  if (!forceImmediate && !currentContent.trim()) return;

  // Don't save if content hasn't changed (unless forced)
  if (!forceImmediate && currentContent === lastSavedContentRef.current) return;

  // Immediately mark as last-saved to prevent double-save overwrites
  lastSavedContentRef.current = currentContent;

  // Wait for in-flight save if not forced
  if (savePromiseRef.current && !forceImmediate) {
    try {
      await savePromiseRef.current;
    } catch (err) {
      console.error("Previous save failed:", err);
    }
  }

  const savePromise = (async () => {
    try {
      setIsSaving(true);
      console.log("Saving note", { title: fileToSave, room_id: roomId, content: currentContent });

      const cacheKey = `${roomId}:${fileToSave}`;
      let existingId = noteIdCacheRef.current.get(cacheKey);

      if (!existingId) {
        existingId = (await findNoteId(fileToSave)) ?? undefined;
      }

      if (existingId) {
        // Only upsert if content is not empty
        const { data, error } = await supabase.from("notes").upsert(
          { title: fileToSave, room_id: roomId, content: currentContent },
          { onConflict: "room_id,title" }
        );
        console.log("upsert result", { data, error });
        return;
      }

      // Insert new note
      const { data, error: insertError } = await supabase
        .from("notes")
        .insert({ title: fileToSave, room_id: roomId || null, content: currentContent })
        .select("id")
        .single();

      if (insertError) {
        if (insertError.message?.includes("duplicate") || insertError.code === "23505") {
          console.warn("Duplicate key, recovering...");
          const recoveredId = await findNoteId(fileToSave);
          if (recoveredId) {
            noteIdCacheRef.current.set(cacheKey, recoveredId);
            const { error: updateError } = await supabase
              .from("notes")
              .update({ content: currentContent })
              .eq("id", recoveredId);

            if (updateError) throw new Error(`Update after duplicate failed: ${updateError.message}`);
            console.log(`✅ Recovered and updated note id=${recoveredId} (${fileToSave})`);
            return;
          }
        }
        throw new Error(`Insert failed: ${insertError.message}`);
      }

      if (data?.id) {
        noteIdCacheRef.current.set(cacheKey, data.id);
        console.log(`✅ Inserted new note id=${data.id} (${fileToSave})`);
      } else {
        throw new Error("Failed to get note ID after insert");
      }
    } catch (err: any) {
      console.error("❌ Save failed:", err);
      setError(`Failed to save ${fileToSave}: ${err.message || "Unknown error"}`);
      throw err;
    } finally {
      setIsSaving(false);
    }
  })();

  savePromiseRef.current = savePromise;
  return savePromise;
}, [roomId, findNoteId]);

  // Debounced save function - triggers 1 second after inactivity
  const debouncedSave = useCallback(
    debounce(() => {
      if (isMountedRef.current && isLoadedRef.current) {
        saveDoc().catch(console.error);
      }
    }, 1000), // Save 1 second after inactivity
    [saveDoc]
  );

  // Load existing note from database
  const loadExistingNote = useCallback(async (ytext: Y.Text, fileName: string) => {
    if (!fileName) return;
    setIsLoading(true);
    try {
      console.log(`Loading existing note: ${fileName} from room ${roomId}`);
      const { data } = await supabase
        .from("notes")
        .select("*")
        .eq("title", fileName)
        .eq("room_id", roomId)
        .maybeSingle() as { data: Note | null };

      if (data && !isValidNote(data)) {
        throw new Error("Invalid note data from database");
      }

      if (data?.content && ytext.length === 0) {
        const content = data.content;
        if (isMountedRef.current && currentFileRef.current === fileName) {
          isUpdatingFromRemoteRef.current = true;
          ytext.delete(0, ytext.length);
          ytext.insert(0, content);
          lastSavedContentRef.current = content;
          setText(content);
          isUpdatingFromRemoteRef.current = false;
          console.log(`✅ Loaded existing note from database: ${fileName} (${content.length} chars)`);
          
          // Cache the note ID if we have it
          if ((data as any).id) {
            const cacheKey = `${roomId}:${fileName}`;
            noteIdCacheRef.current.set(cacheKey, (data as any).id);
          }
        }
      }
      isLoadedRef.current = true;
    } catch (err: any) {
      console.error(`❌ Failed to load ${fileName} from DB:`, err);
      setError(`Failed to load note: ${fileName} - ${err.message || 'Unknown error'}`);
      isLoadedRef.current = true; // Still mark as loaded to allow saving
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  // Text observer - triggers on every Yjs change
  const textObserver = useCallback(() => {
    if (!isMountedRef.current || !ytextRef.current) return;
    
    const newText = ytextRef.current.toString();
    setText(newText);
    
    // Only trigger save debounce if:
    // 1. Not updating from remote
    // 2. Document is loaded
    // 3. Content actually changed
    if (!isUpdatingFromRemoteRef.current && isLoadedRef.current) {
      // Cancel existing save timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      // Trigger debounced save
      debouncedSave();
    }
  }, [debouncedSave]);

  // Debounced Yjs update for local changes
  const debouncedYjsUpdate = useCallback(
    debounce((value: string) => {
      const ytext = ytextRef.current;
      if (!ytext || isUpdatingFromRemoteRef.current) return;
      
      // Only update if content is different
      if (ytext.toString() !== value) {
        isUpdatingFromRemoteRef.current = true;
        ytext.delete(0, ytext.length);
        ytext.insert(0, value);
        isUpdatingFromRemoteRef.current = false;
      }
    }, 100), // Quick debounce for Yjs updates
    []
  );

  // Main collaboration setup
  useEffect(() => {
    if (!currentFile || !roomId) return;

    console.log(`🔧 Setting up collaboration for file: ${currentFile} in room: ${roomId}`);

    // Reset state
    isLoadedRef.current = false;
    setError(null);
    setText("");
    setConnectionStatus('connecting');
    setIsLoading(true);
    lastSavedContentRef.current = "";

    // Clear any existing timeouts
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    debouncedSave.cancel();

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;
    const ytext = ydoc.getText(currentFile);
    ytextRef.current = ytext;

    // Initialize socket if not exists
    if (!socketRef.current) {
      socketRef.current = io(SERVER_URL, {
        transports: ["websocket", "polling"],
        timeout: 5000,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      });
    }
    const socket = socketRef.current;

    ytext.observe(textObserver);

    // Socket event handlers
    const handleYjsUpdate = ({ update, fileName }: { update: number[]; fileName: string }) => {
      if (fileName !== currentFileRef.current) return;
      try {
        isUpdatingFromRemoteRef.current = true;
        const u = Uint8Array.from(update);
        Y.applyUpdate(ydoc, u);
        isUpdatingFromRemoteRef.current = false;
      } catch (e) {
        console.error("❌ Failed to apply remote update:", e);
        setError("Failed to apply remote update");
      }
    };

    const handleFileSyncResponse = ({ fileName, update }: { fileName: string; update: number[] }) => {
      if (fileName !== currentFileRef.current) return;
      try {
        isUpdatingFromRemoteRef.current = true;
        const u = Uint8Array.from(update);
        Y.applyUpdate(ydoc, u);
        isUpdatingFromRemoteRef.current = false;
        
        // If still empty after sync, load from DB
        if (ytext.length === 0 && isMountedRef.current) {
          loadExistingNote(ytext, fileName);
        } else {
          isLoadedRef.current = true;
        }
      } catch (e) {
        console.error("❌ Failed to apply sync response:", e);
        setError("Failed to apply sync response");
      }
    };

    const handleRequestSync = ({ requester, fileName }: { requester: string; fileName: string }) => {
      if (fileName !== currentFileRef.current) return;
      const state = Y.encodeStateAsUpdate(ydoc);
      socket.emit("reply-sync", { to: requester, fileName, update: Array.from(state) });
    };

    const handleSaveFinal = async ({ fileName }: { fileName: string }) => {
      if (fileName === currentFileRef.current) {
        console.log(`💾 Server requested final save for file: ${fileName}`);
        try {
          await saveDoc(fileName, true);
        } catch (error) {
          console.error("❌ Failed to save on server request:", error);
        }
      }
    };

    const handleConnection = () => {
      console.log(`✅ Connected to collaboration server for file: ${currentFile}`);
      setConnectionStatus('connected');
      setError(null);
      socket.emit("join-file", { roomId, fileName: currentFile });
      socket.emit("request-file-sync", { roomId, fileName: currentFile });
      
      // Load from DB after sync attempt
      setTimeout(() => {
        if (currentFileRef.current === currentFile && isMountedRef.current && ytextRef.current) {
          loadExistingNote(ytextRef.current, currentFile);
        }
      }, 1000);
    };

    // Attach socket listeners
    socket.on("yjs-update", handleYjsUpdate);
    socket.on("file-sync-response", handleFileSyncResponse);
    socket.on("request-sync", handleRequestSync);
    socket.on("save-final", handleSaveFinal);
    socket.on("connect", handleConnection);
    socket.on("connect_error", (error) => {
      console.error("❌ Connection error:", error);
      setConnectionStatus('disconnected');
      setError("Failed to connect to collaboration server");
    });
    socket.on("disconnect", (reason) => {
      console.log("🔌 Disconnected:", reason);
      setConnectionStatus('disconnected');
    });
    socket.io.on("reconnect_error", (err) => {
      console.error("❌ Reconnect error:", err);
      setError("Lost connection to server. Working offline. Changes will sync when connection is restored.");
    });

    // Debounced Yjs update emission
    const debouncedEmitUpdate = debounce((update: Uint8Array) => {
      if (!socket.connected) return;
      socket.emit("yjs-update", {
        roomId,
        fileName: currentFileRef.current,
        update: Array.from(update),
      });
    }, 100);

    const updateHandler = (update: Uint8Array, origin: any) => {
      if (origin === 'remote') return;
      try {
        debouncedEmitUpdate(update);
      } catch (e) {
        console.error("❌ Failed to send update:", e);
        setError("Failed to send update");
      }
    };

    ydoc.on("update", updateHandler);

    // Browser event handlers
    const handleUnload = async (event: BeforeUnloadEvent) => {
      if (ytextRef.current && lastSavedContentRef.current !== ytextRef.current.toString()) {
        event.preventDefault();
        event.returnValue = 'You have unsaved changes';
        saveDoc(currentFile, true).catch(console.error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && ytextRef.current) {
        const currentContent = ytextRef.current.toString();
        if (currentContent !== lastSavedContentRef.current) {
          saveDoc(currentFile, true).catch(console.error);
        }
      }
    };

    window.addEventListener("beforeunload", handleUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      console.log(`🧹 Cleaning up CollabEditor for file: ${currentFile}`);
      
      // Cancel debounced functions
      debouncedSave.cancel();
      debouncedEmitUpdate.cancel();
      
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      
      // Final save before cleanup
      const cleanup = async () => {
  const ytext = ytextRef.current;
  if (!ytext) return;

  const currentContent = ytext.toString();

  // Only save if content changed and not empty
  if (currentContent && currentContent !== lastSavedContentRef.current) {
    console.log("🧹 CLEANUP SAVE: Final save before unmount", { currentContent });
    try {
      await saveDoc(currentFileRef.current, true);
      console.log("✅ CLEANUP SAVE COMPLETE");
    } catch (err) {
      console.error("Failed cleanup save:", err);
    }
  } else {
    console.log("🧹 CLEANUP SKIPPED: content unchanged or empty");
  }

  // Leave file on server
  if (socketRef.current?.connected) {
    socketRef.current.emit("leave-file", { roomId, fileName: currentFileRef.current });
  }
};
      cleanup();

      // Clean up observers and listeners
      ytext.unobserve(textObserver);
      ydoc.off("update", updateHandler);
      ydoc.destroy();
      socket.off("yjs-update", handleYjsUpdate);
      socket.off("file-sync-response", handleFileSyncResponse);
      socket.off("request-sync", handleRequestSync);
      socket.off("save-final", handleSaveFinal);
      socket.off("connect", handleConnection);
      window.removeEventListener("beforeunload", handleUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      
      // Reset refs
      ydocRef.current = null;
      ytextRef.current = null;
      isLoadedRef.current = false;
      setConnectionStatus('disconnected');
    };
  }, [currentFile, roomId, saveDoc, loadExistingNote, textObserver, debouncedSave]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      debouncedSave.cancel();
      if (savePromiseRef.current) {
        savePromiseRef.current.catch(console.error);
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      // Clear note ID cache
      noteIdCacheRef.current.clear();
    };
  }, [debouncedSave]);

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-400';
      case 'connecting': return 'text-yellow-400';
      case 'disconnected': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'disconnected': return 'Disconnected';
      default: return 'Unknown';
    }
  };

  return (
    <div>
      {isLoading && <div style={{ marginBottom: "10px", color: "#666" }}>Loading note...</div>}
      <textarea
        value={text}
        onChange={(e) => {
          const newValue = e.target.value;
          setText(newValue);
          debouncedYjsUpdate(newValue);
        }}
        style={{
          width: "100%",
          height: 300,
          padding: "10px",
          fontSize: "14px",
          fontFamily: "monospace",
          border: "1px solid #ccc",
          borderRadius: "4px",
          resize: "vertical",
        }}
        placeholder={`Start typing your collaborative note: ${currentFile}...`}
        disabled={isLoading}
      />
      <div
        style={{
          marginTop: "10px",
          fontSize: "12px",
          color: "#666",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span>{isSaving ? "Saving..." : "Saved"}</span>
          <span className={getConnectionStatusColor()}>
            {getConnectionStatusText()}
          </span>
        </div>
        <span>File: {currentFile} | Room: {roomId}</span>
      </div>
      {error && (
        <div
          style={{
            color: "red",
            marginTop: "5px",
            fontSize: "12px",
            padding: "5px",
            backgroundColor: "#fee",
            border: "1px solid #fcc",
            borderRadius: "3px",
          }}
        >
          {error}
          <button
            onClick={() => setError(null)}
            style={{
              marginLeft: "10px",
              background: "none",
              border: "none",
              color: "red",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}