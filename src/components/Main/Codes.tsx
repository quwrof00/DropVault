import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthUser } from "../../hooks/useAuthUser";
import { supabase } from "../../lib/supabase-client";
import SubSidebar from "../PageHelpers/SubSidebar";
import CodeEditor from "@uiw/react-textarea-code-editor";
import Compiler from "../Compiler/Compiler";
import { Dialog, type DialogProps } from "../UI/Dialog";
import { Loader2 } from "lucide-react";

const languages = [
  { label: "C", value: "c" },
  { label: "C++", value: "cpp" },
  { label: "Java", value: "java" },
  { label: "JavaScript", value: "javascript" },
  { label: "Python", value: "python" },
];

type Snippet = {
  code: string;
  language: string;
};

type CodesProps = {
  roomId?: string | null;
};

export default function Codes({ roomId }: CodesProps) {
  const user = useAuthUser();
  const navigate = useNavigate();
  const [snippets, setSnippets] = useState<{ [key: string]: Snippet }>({});
  const [currentTitle, setCurrentTitle] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog State
  const [dialog, setDialog] = useState<Partial<DialogProps> & { isOpen: boolean }>({ isOpen: false, title: "" });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile sidebar state

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const lastSavedCodeRef = useRef<string>("");

  // Fetch snippets from Supabase
  useEffect(() => {
    if (user === undefined) return;
    if (!user) {
      navigate("/login");
      return;
    }

    (async () => {
      setIsLoading(true);
      setError(null);

      try {
        let query = supabase
          .from("codes")
          .select("title, code, language")
          .eq("user_id", user.id);

        if (roomId) {
          query = query.eq("room_id", roomId);
        } else {
          query = query.is("room_id", null);
        }

        const { data: supabaseData, error } = await query;

        if (error) {
          console.error("Failed to fetch Supabase snippets", error);
          setError("Failed to load code snippets. Please try again.");
          setSnippets({});
          return;
        }

        const supabaseSnippets: { [key: string]: Snippet } = {};
        for (const { title, code, language } of supabaseData || []) {
          supabaseSnippets[title] = {
            code: code || "",
            language: language || "javascript",
          };
        }

        setSnippets(supabaseSnippets);

        if (!currentTitle || !supabaseSnippets[currentTitle]) {
          const firstTitle = Object.keys(supabaseSnippets)[0];
          if (firstTitle) {
            setCurrentTitle(firstTitle);
            setCode(supabaseSnippets[firstTitle].code);
            lastSavedCodeRef.current = supabaseSnippets[firstTitle].code;
          }
        }
      } catch (err) {
        console.error("Error loading snippets:", err);
        setError("An unexpected error occurred while loading snippets.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [user, navigate, roomId]);

  // Dedicated Save Function
  const saveSnippet = async (title: string, newCode: string, language: string, forceImmediate = false) => {
    if (!user || !title || !isMountedRef.current) return;

    // Skip if no changes, unless forced
    if (!forceImmediate && newCode === lastSavedCodeRef.current) return;

    try {
      setIsSaving(true);
      const { error } = await supabase
        .from("codes")
        .upsert(
          {
            user_id: user.id,
            title: title,
            code: newCode,
            language: language,
            room_id: roomId ?? null,
          },
          {
            onConflict: roomId ? "user_id,title,room_id" : "user_id,title",
          }
        );

      if (error) throw error;

      lastSavedCodeRef.current = newCode;

      // Update local snippets state to match
      setSnippets((prev) => ({
        ...prev,
        [title]: { ...prev[title], code: newCode },
      }));

      if (isMountedRef.current) setError(null);

    } catch (err: any) {
      console.error("Save error:", err);
      if (isMountedRef.current) {
        setError("Failed to save snippet. Changes may be lost.");
      }
    } finally {
      if (isMountedRef.current) setIsSaving(false);
    }
  };

  // Auto-save effect
  useEffect(() => {
    if (!currentTitle || !user) return;
    const snippet = snippets[currentTitle];
    if (!snippet) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && code !== lastSavedCodeRef.current) {
        saveSnippet(currentTitle, code, snippet.language).catch(console.error);
      }
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [code, currentTitle, user, roomId, snippets]); // Note: snippets dependency might re-trigger if other fields change, but code check protects us

  // Save on visibility change and unload
  useEffect(() => {
    if (!user || !currentTitle) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && code !== lastSavedCodeRef.current) {
        const snippet = snippets[currentTitle];
        if (snippet) {
          saveSnippet(currentTitle, code, snippet.language, true).catch(console.error);
        }
      }
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (code !== lastSavedCodeRef.current) {
        const snippet = snippets[currentTitle];
        if (snippet) {
          saveSnippet(currentTitle, code, snippet.language, true).catch(console.error);
        }
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
  }, [user, currentTitle, code, snippets]);

  // Component cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      // Attempt final save on unmount if needed
      if (user && currentTitle && code !== lastSavedCodeRef.current) {
        const snippet = snippets[currentTitle];
        if (snippet) {
          saveSnippet(currentTitle, code, snippet.language, true).catch(console.error);
        }
      }
    };
  }, [user, currentTitle, code, snippets]);

  if (user === undefined || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-gray-700">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-gray-600 border-t-green-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-r-green-400 rounded-full animate-ping"></div>
          </div>
          <p className="text-gray-300 text-base sm:text-lg font-medium">
            {user === undefined ? "Loading..." : "Loading your code snippets..."}
          </p>
        </div>
      </div>
    );
  }

  const handleSelect = (title: string) => {
    setCurrentTitle(title);
    setCode(snippets[title].code);
    setError(null);
    setIsSidebarOpen(false); // Close on mobile
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

  const handleNewSnippet = (prefillPath?: string) => {
    if (!user) return;

    const initialValue = prefillPath ? `${prefillPath}/` : "";

    setDialog({
      isOpen: true,
      title: "New Snippet",
      message: "Enter name or path for your snippet:",
      type: "input",
      placeholder: "folder/snippet-name",
      defaultValue: initialValue,
      confirmText: "Create",
      onConfirm: async (title) => {
        if (!title || !title.trim()) return;

        const trimmedTitle = title.trim();
        if (snippets[trimmedTitle]) {
          showAlert(`Snippet with title "${trimmedTitle}" already exists!`);
          return;
        }

        setIsCreating(true);
        try {
          const { error } = await supabase.from("codes").insert({
            user_id: user.id,
            title: trimmedTitle,
            code: "",
            language: "javascript",
            room_id: roomId ?? null,
          });

          if (error) {
            console.error("Failed to create snippet:", error);
            showAlert(`Failed to create snippet: ${error.message}`);
            return;
          }

          const newSnippet = { code: "", language: "javascript" };
          setSnippets((prev) => ({ ...prev, [trimmedTitle]: newSnippet }));
          setCurrentTitle(trimmedTitle);
          setCode("");
          lastSavedCodeRef.current = "";
          setError(null);
          closeDialog();
        } catch (err) {
          console.error("Error creating snippet:", err);
          showAlert("Failed to create snippet. Please try again.");
        } finally {
          setIsCreating(false);
        }
      }
    });
  };

  const handleDelete = (title: string) => {
    if (!user) return;

    setDialog({
      isOpen: true,
      title: "Delete Snippet",
      message: `Are you sure you want to delete "${title}"?`,
      type: "confirm",
      confirmText: "Delete",
      variant: "danger",
      onConfirm: async () => {
        const deleteQuery = supabase
          .from("codes")
          .delete()
          .eq("user_id", user.id)
          .eq("title", title);

        if (roomId) {
          deleteQuery.eq("room_id", roomId);
        } else {
          deleteQuery.is("room_id", null);
        }

        const { error } = await deleteQuery;

        if (error) {
          showAlert(`Failed to delete snippet "${title}": ${error.message}`);
          return;
        }

        const updated = { ...snippets };
        delete updated[title];
        setSnippets(updated);

        if (title === currentTitle) {
          const next = Object.keys(updated)[0] || "";
          setCurrentTitle(next);
          setCode(updated[next]?.code || "");
        }
        setError(null);
        closeDialog();
      }
    });
  };


  const handleRename = (title: string) => {
    if (!user) return;

    setDialog({
      isOpen: true,
      title: "Rename Snippet",
      message: "Enter new title:",
      type: "input",
      defaultValue: title,
      confirmText: "Rename",
      onConfirm: async (newTitle) => {
        if (!newTitle || !newTitle.trim() || newTitle.trim() === title) {
          closeDialog();
          return;
        }

        const trimmedTitle = newTitle.trim();
        if (snippets[trimmedTitle]) {
          showAlert(`Snippet with title "${trimmedTitle}" already exists!`);
          return;
        }

        const updateQuery = supabase
          .from("codes")
          .update({ title: trimmedTitle })
          .eq("user_id", user.id)
          .eq("title", title);

        if (roomId) {
          updateQuery.eq("room_id", roomId);
        } else {
          updateQuery.is("room_id", null);
        }

        const { error } = await updateQuery;

        if (error) {
          showAlert(`Failed to rename snippet "${title}": ${error.message}`);
          return;
        }

        setSnippets((prev) => {
          const updated: { [key: string]: Snippet } = {};
          Object.keys(prev).forEach((key) => {
            updated[key === title ? trimmedTitle : key] = prev[key];
          });
          return updated;
        });

        if (title === currentTitle) setCurrentTitle(trimmedTitle);
        setError(null);
        closeDialog();
      }
    });
  };

  const handleLanguageChange = async (language: string) => {
    if (!currentTitle || !user) return;

    try {
      // Update local state immediately for better UX
      setSnippets((prev) => ({
        ...prev,
        [currentTitle]: {
          ...prev[currentTitle],
          language,
        },
      }));

      // Build the query properly
      let updateQuery = supabase
        .from("codes")
        .update({ language })
        .eq("user_id", user.id)
        .eq("title", currentTitle);

      // Add room condition based on roomId
      if (roomId) {
        updateQuery = updateQuery.eq("room_id", roomId);
      } else {
        updateQuery = updateQuery.is("room_id", null);
      }

      const { error } = await updateQuery;

      if (error) {
        console.error("Failed to update language:", error);
        setError("Failed to update language setting.");
      }
    } catch (err) {
      console.error("Error updating language:", err);
      setError("Failed to update language setting.");
    }
  };

  const handleCodeChange = (code: string) => {
    setCode(code);
  };

  const filteredSnippets = Object.keys(snippets)
    .filter((title) => title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  return (
    <div className="flex flex-col md:flex-row h-full bg-gray-700 rounded-lg shadow-lg overflow-hidden transition-all duration-300 relative">
      {/* Error Banner */}
      {error && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2 animate-slideDown">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-sm">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-200 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Dialog */}
      <Dialog
        onClose={closeDialog}
        {...dialog}
        isOpen={dialog.isOpen}
        title={dialog.title || ""}
      />

      {/* Collapsible Sidebar */}
      <SubSidebar
        search={search}
        setSearch={setSearch}
        items={filteredSnippets}
        onCreate={(path) => handleNewSnippet(path)}
        onCreateFileInFolder={(path) => handleNewSnippet(path)}
        onSelect={handleSelect}
        onRename={handleRename}
        onDelete={handleDelete}
        currentItem={currentTitle}
        typeLabel="Snippet"
        isCreating={isCreating}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Editor Area */}
      <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 overflow-auto bg-gray-700 transition-all duration-300">
        {/* Header with controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Trigger */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden text-gray-400 hover:text-white p-1 rounded-md hover:bg-gray-600 flex-shrink-0"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <h2 className="text-xl sm:text-2xl font-semibold text-gray-200 truncate">
              {currentTitle || "No Snippet Selected"}
            </h2>
            {isSaving && (
              <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 transition-all duration-300">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="text-xs font-medium">Saving changes...</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {/* Room indicator */}
            {roomId && (
              <div className="bg-green-600/20 text-green-300 px-3 py-1 rounded-full text-sm font-medium border border-green-600/30">
                Room Snippets
              </div>
            )}

            {/* Language selector */}
            <div className="relative">
              <select
                disabled={!currentTitle}
                value={currentTitle ? snippets[currentTitle]?.language : "javascript"}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="p-2 pl-3 pr-8 rounded-lg border border-gray-600/50 bg-gray-800/50 backdrop-blur-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {languages.map(({ label, value }) => (
                  <option key={value} value={value} className="bg-gray-800 text-gray-200">
                    {label}
                  </option>
                ))}
              </select>
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Editor Content */}
        <div className="flex-1 flex flex-col overflow-auto">
          {currentTitle ? (
            <div className="flex flex-col gap-4 h-full">
              {/* Code Editor */}
              <div className="flex-1 bg-gray-800/50 backdrop-blur-sm border border-gray-600/50 rounded-xl shadow-lg overflow-hidden flex flex-col">
                <div className="p-3 border-b border-gray-600/30 bg-gray-900/30 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    </div>
                    <div className="text-xs text-gray-400 font-mono">
                      {snippets[currentTitle]?.language.toUpperCase()}
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-auto">
                  <CodeEditor
                    language={snippets[currentTitle].language}
                    value={code}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    padding={20}
                    style={{
                      fontSize: 14,
                      backgroundColor: "transparent",
                      color: "#e5e7eb",
                      fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace",
                      border: "none",
                      minHeight: "300px",
                      lineHeight: "1.5",
                      height: "auto",
                    }}
                  />
                </div>
              </div>

              {/* Compiler Section */}
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-lg p-4 border border-gray-600/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-200 flex items-center space-x-2">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span>Compiler Output</span>
                  </h3>
                  {isCompiling && (
                    <div className="flex items-center space-x-2 text-green-400">
                      <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm">Running...</span>
                    </div>
                  )}
                </div>
                <Compiler
                  language={snippets[currentTitle].language}
                  code={code}
                  onCompileStart={() => setIsCompiling(true)}
                  onCompileEnd={() => setIsCompiling(false)}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-gray-600/30 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </div>
                <div>
                  <p className="text-gray-300 font-medium text-base sm:text-lg mb-2">
                    No snippet selected
                  </p>
                  <p className="text-gray-400 text-sm">
                    Select an existing snippet or create a new one to start coding
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
