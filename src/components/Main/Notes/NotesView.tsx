import SubSidebar from "../../PageHelpers/SubSidebar";
import { Dialog, type DialogProps } from "../../UI/Dialog";
import CollabEditor from "../../CollabEditor";
import Editor from "../../Editor/Editor";
import ItemDiscussion from "../ItemDiscussion";
import { type NoteRow, type NotesUser as User, getNoteId } from "./helpers";
import { getUserColorClasses } from "../../../lib/colors";
import { useInvertedIndex } from "../../../hooks/useInvertedIndex";
import { NoteSearchModal } from "../../UI/NoteSearchModal";
import { useState, useEffect } from "react";
import { Skeleton } from "../../UI/Skeleton";

type NotesViewProps = {
  roomId?: string | null;
  user: User | null | undefined;
  isLoading: boolean;
  isDecrypting: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  dialog: Partial<DialogProps> & { isOpen: boolean };
  closeDialog: () => void;
  search: string;
  setSearch: (s: string) => void;
  allFilePaths: { id: string; path: string }[];
  handleNewFile: (path?: string) => void;
  handleNewFolder: () => void;
  handleFileSelect: (id: string) => void;
  handleRename: (id: string) => void;
  handleDelete: (id: string) => void;
  currentFile: string;
  isCreating: boolean;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (o: boolean) => void;
  itemCounts: Record<string, number>;
  supabaseNotes: NoteRow[] | undefined;
  userEmails: Record<string, string> | undefined;
  currentPath: string;
  isSaving: boolean;
  isDiscussionOpen: boolean;
  setIsDiscussionOpen: (o: boolean) => void;
  isFullScreen: boolean;
  setIsFullScreen: (o: boolean | ((prev: boolean) => boolean)) => void;
  currentNote: NoteRow | undefined;
  isReadOnly: boolean;
  text: string;
  handleTextUpdate: (text: string) => void;
  files: Record<string, string>;
};

export default function NotesView({
  roomId,
  user,
  isLoading,
  isDecrypting,
  error,
  setError,
  dialog,
  closeDialog,
  search,
  setSearch,
  allFilePaths,
  handleNewFile,
  handleNewFolder,
  handleFileSelect,
  handleRename,
  handleDelete,
  currentFile,
  isCreating,
  isSidebarOpen,
  setIsSidebarOpen,
  itemCounts,
  supabaseNotes,
  userEmails,
  currentPath,
  isSaving,
  isDiscussionOpen,
  setIsDiscussionOpen,
  isFullScreen,
  setIsFullScreen,
  currentNote,
  isReadOnly,
  text,
  handleTextUpdate,
  files,
}: NotesViewProps) {
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const index = useInvertedIndex(files);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col md:flex-row h-full bg-gray-700 rounded-lg shadow-lg overflow-hidden">
        {/* Sidebar Skeleton */}
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-gray-600 bg-gray-800/30 flex flex-col p-4 shrink-0">
          <Skeleton className="h-10 w-full mb-6" />
          <div className="space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-5/6" />
            <Skeleton className="h-6 w-4/5" />
          </div>
        </div>
        {/* Main Content Skeleton */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
          <div className="flex-1 bg-gray-800/20 border border-gray-600/30 rounded-xl p-6 space-y-4">
            <Skeleton className="h-10 w-1/2 mb-8" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-5/6 mt-8" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-full bg-gray-700 rounded-lg shadow-lg overflow-hidden relative">
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2">
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-2 text-red-200 hover:text-white">
            ×
          </button>
        </div>
      )}



      <Dialog onClose={closeDialog} {...dialog} isOpen={dialog.isOpen} title={dialog.title || ""} />
      
      <NoteSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        files={files}
        index={index}
        onSelectNote={(id) => {
          handleFileSelect(id);
          setIsSidebarOpen(false);
        }}
      />

      <SubSidebar
        search={search}
        setSearch={setSearch}
        items={allFilePaths}
        onCreate={(path) => handleNewFile(path)}
        onCreateFileInFolder={(path) => handleNewFile(path)}
        onCreateFolder={handleNewFolder}
        onSelect={(fileId) => {
          handleFileSelect(fileId);
          setIsSidebarOpen(false);
        }}
        onRename={handleRename}
        onDelete={handleDelete}
        currentItem={currentFile}
        typeLabel="Note"
        isCreating={isCreating}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpenSearch={() => setIsSearchModalOpen(true)}
        itemCounts={itemCounts}
        isItemEditable={(id) => {
          const note = supabaseNotes?.find((item) => getNoteId(item.user_id, item.title) === id);
          return note ? (!note.user_id || note.user_id === user?.id) : true;
        }}
        getItemBadge={(id) => {
          if (!roomId || !user) return undefined;

          const note = supabaseNotes?.find((item) => getNoteId(item.user_id, item.title) === id);
          if (note?.user_id) {
            const color = getUserColorClasses(note.user_id);
            if (note.user_id === user.id) {
              return { text: "Me", colorClass: `${color.bgSoft} ${color.text} ${color.border} border` };
            }

            const email = userEmails?.[note.user_id];
            const prefix = email ? email.split("@")[0] : "Shared";
            return {
              text: prefix,
              colorClass: `${color.bgSoft} ${color.text} ${color.border} border`,
            };
          }

          return undefined;
        }}
      />

      <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 overflow-hidden bg-gray-700">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
          <div className="flex items-center gap-3">
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
                <span>{currentPath ? currentPath.split("/").pop() : "No Note Selected"}</span>
              </h2>
            </div>

            {isSaving && (
              <div className="flex items-center space-x-2 text-blue-400 ml-4">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm font-normal">Saving...</span>
              </div>
            )}

            {roomId && currentFile && (
              <button
                onClick={() => setIsDiscussionOpen(!isDiscussionOpen)}
                className={`p-2 rounded-lg relative ${
                  isDiscussionOpen ? "text-blue-400 bg-blue-400/10" : "text-gray-400 hover:text-blue-400 hover:bg-blue-400/10"
                }`}
                title={isDiscussionOpen ? "Close Discussion" : "Open Discussion"}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                {itemCounts[currentFile] > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white ring-2 ring-gray-900">
                    {itemCounts[currentFile] > 99 ? "99+" : itemCounts[currentFile]}
                  </span>
                )}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
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
            {isReadOnly && (
              <div className="bg-red-600/20 text-red-300 px-3 py-1 rounded-full text-sm font-medium border border-red-600/30">
                Read Only
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          {currentFile ? (
            <div className="flex-1 flex flex-col min-h-0 gap-4">
              <div
                className={`flex flex-col overflow-hidden ${
                  isFullScreen
                    ? "fixed inset-0 z-[100] bg-gray-900 w-full h-full p-0 border-none rounded-none"
                    : "flex-1 bg-gray-800/50 backdrop-blur-sm border border-gray-600/50 rounded-xl shadow-lg p-3 sm:p-4"
                }`}
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

                {roomId && currentNote?.is_collaborative ? (
                  <CollabEditor
                    roomId={roomId}
                    fileName={currentPath}
                    initialContent={text}
                    onUpdate={handleTextUpdate}
                    isFullScreen={isFullScreen}
                    readOnly={isReadOnly}
                    key={currentFile}
                  />
                ) : (
                  <Editor
                    content={text}
                    onUpdate={handleTextUpdate}
                    isFullScreen={isFullScreen}
                    readOnly={isReadOnly}
                    key={currentFile}
                  />
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
                      : "Select a note from the sidebar to begin editing"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
