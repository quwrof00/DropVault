import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthUser } from "../../hooks/useAuthUser";
import { supabase } from "../../lib/supabase-client";
import SubSidebar from "../PageHelpers/SubSidebar";
import CodeEditor from "@uiw/react-textarea-code-editor";
import Compiler from "../Compiler/Compiler";

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

  // Sync updates to Supabase
  useEffect(() => {
    if (!currentTitle || !user) return;

    const timeout = setTimeout(async () => {
      const snippet = snippets[currentTitle];
      if (!snippet) return;

      setIsSaving(true);
      try {
        const { error } = await supabase
          .from("codes")
          .upsert(
            {
              user_id: user.id,
              title: currentTitle,
              code: code,
              language: snippet.language,
              room_id: roomId ?? null,
            },
            {
              onConflict: roomId ? "user_id,title,room_id" : "user_id,title",
            }
          );

        if (error) {
          console.error("Sync failed:", error.message);
          setError("Failed to save snippet. Changes may be lost.");
          return;
        }

        setSnippets((prev) => ({
          ...prev,
          [currentTitle]: { ...prev[currentTitle], code },
        }));
      } catch (err) {
        console.error("Save error:", err);
        setError("Failed to save snippet. Changes may be lost.");
      } finally {
        setIsSaving(false);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [code, currentTitle, user, roomId, snippets]);

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
  };

  const handleNewSnippet = async () => {
    if (!user) return;

    const title = prompt("Enter a name for your snippet:");
    if (!title || !title.trim()) return;
    
    const trimmedTitle = title.trim();
    if (snippets[trimmedTitle]) {
      alert(`Snippet with title "${trimmedTitle}" already exists!`);
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
        alert(`Failed to create snippet: ${error.message}`);
        return;
      }

      const newSnippet = { code: "", language: "javascript" };
      setSnippets((prev) => ({ ...prev, [trimmedTitle]: newSnippet }));
      setCurrentTitle(trimmedTitle);
      setCode("");
      setError(null);
    } catch (err) {
      console.error("Error creating snippet:", err);
      alert("Failed to create snippet. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (title: string) => {
    if (!user || !confirm(`Delete "${title}"?`)) return;

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
      alert(`Failed to delete snippet "${title}": ${error.message}`);
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
  };

  const handleRename = async (title: string) => {
    if (!user) return;

    const newTitle = prompt("Enter new title:", title);
    if (!newTitle || !newTitle.trim() || newTitle.trim() === title) return;
    
    const trimmedTitle = newTitle.trim();
    if (snippets[trimmedTitle]) {
      alert(`Snippet with title "${trimmedTitle}" already exists!`);
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
      alert(`Failed to rename snippet "${title}": ${error.message}`);
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
    <div className="flex h-[calc(100vh-4rem)] bg-gray-700 rounded-lg shadow-lg overflow-hidden transition-all duration-300">
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

      {/* Collapsible Sidebar */}
      <SubSidebar
        search={search}
        setSearch={setSearch}
        items={filteredSnippets}
        onCreate={handleNewSnippet}
        onSelect={handleSelect}
        onRename={handleRename}
        onDelete={handleDelete}
        currentItem={currentTitle}
        typeLabel="Snippet"
        isCreating={isCreating}
      />

      {/* Editor Area */}
      <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 overflow-auto bg-gray-700 transition-all duration-300">
        {/* Header with controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-200 truncate">
              {currentTitle || "No Snippet Selected"}
            </h2>
            {isSaving && (
              <div className="flex items-center space-x-2 text-green-400">
                <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm font-normal">Saving...</span>
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

