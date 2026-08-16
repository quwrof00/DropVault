import { Dialog, type DialogProps } from "../../UI/Dialog";
import ItemDiscussion from "../ItemDiscussion";
import { formatFileSize, getFileIcon, type StoredFileEntry } from "./helpers";

type FilesViewProps = {
  roomId?: string | null;
  files: Record<string, StoredFileEntry>;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  dragOver: boolean;
  isLoading: boolean;
  visibleCount: number;
  filteredFiles: Array<[string, StoredFileEntry]>;
  expandedFile: string | null;
  renamingFile: string | null;
  newFileName: string;
  setNewFileName: (value: string) => void;
  setRenamingFile: (value: string | null) => void;
  isRenaming: boolean;
  uploadingFiles: Set<string>;
  itemCounts: Record<string, number>;
  dialog: Partial<DialogProps> & { isOpen: boolean };
  closeDialog: () => void;
  targetRef: (node?: Element | null) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void | Promise<void>;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onToggleDiscussion: (name: string) => void;
  onStartRename: (name: string) => void;
  onRename: (name: string, newName: string) => void | Promise<void>;
  onDelete: (name: string) => void;
  getPublicUrl: (fileName: string, lastModified?: number) => string | undefined;
};

export default function FilesView({
  roomId,
  searchTerm,
  setSearchTerm,
  dragOver,
  isLoading,
  visibleCount,
  filteredFiles,
  expandedFile,
  renamingFile,
  newFileName,
  setNewFileName,
  setRenamingFile,
  isRenaming,
  uploadingFiles,
  itemCounts,
  dialog,
  closeDialog,
  targetRef,
  onFileChange,
  onDrop,
  onDragOver,
  onDragLeave,
  onToggleDiscussion,
  onStartRename,
  onRename,
  onDelete,
  getPublicUrl,
}: FilesViewProps) {
  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 bg-gray-800 rounded-xl shadow-xl max-w-7xl mx-auto">
      <Dialog onClose={closeDialog} {...dialog} isOpen={dialog.isOpen} title={dialog.title || ""} />
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-bold text-white">{roomId ? "Room Files" : "My Files"}</h2>
        <div className="text-sm text-gray-400">
          {filteredFiles.length} file{filteredFiles.length !== 1 ? "s" : ""}
        </div>
      </div>
      <div
        className={`relative border-2 border-dashed rounded-xl p-4 sm:p-8 ${
          dragOver ? "border-blue-400 bg-blue-900/20" : "border-gray-600 hover:border-gray-500 bg-gray-700/50"
        }`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <div className="text-center space-y-3 sm:space-y-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-gray-400">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <p className="text-gray-300 text-base sm:text-lg font-medium">{dragOver ? "Drop your files here" : "Upload Files"}</p>
            <p className="text-gray-500 text-xs sm:text-sm mt-1">Drag & drop files or click to browse</p>
          </div>
          <label className="inline-block">
            <input type="file" multiple onChange={onFileChange} className="hidden" />
            <span className="inline-flex items-center px-4 py-2 sm:px-6 sm:py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 cursor-pointer text-sm sm:text-base">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Choose Files
            </span>
          </label>
          <p className="text-[10px] sm:text-xs text-gray-500">Any file type up to 50MB</p>
        </div>
      </div>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          placeholder="Search files..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-600 bg-gray-700 text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-600 border-t-blue-500"></div>
            <p className="text-gray-400 font-medium">Loading files...</p>
          </div>
        </div>
      )}
      {!isLoading && filteredFiles.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto text-gray-500 mb-4">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-400 text-lg font-medium">{searchTerm ? "No files match your search" : "No files found"}</p>
          <p className="text-gray-500 text-sm mt-1">{searchTerm ? "Try adjusting your search terms" : "Upload some files to get started"}</p>
        </div>
      )}
      <div className="space-y-3">
        {filteredFiles.slice(0, visibleCount).map(([name, file]) => {
          const fileIcon = getFileIcon(name);
          return (
            <div key={name} className={`group rounded-2xl shadow-lg transition-all duration-300 overflow-hidden border ${expandedFile === name ? "bg-gray-800/80 border-blue-500/50 shadow-blue-900/20 scale-[1.01]" : "bg-gray-900/40 border-white/5 hover:border-blue-500/30 hover:bg-gray-800/60"}`}>
              <div className="p-3 sm:p-5">
                {renamingFile === name ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${fileIcon.bg} flex items-center justify-center text-lg`}>{fileIcon.icon}</div>
                      <input
                        type="text"
                        className="flex-1 p-2 rounded-lg border border-gray-600 bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            onRename(name, newFileName.trim());
                          }
                          if (e.key === "Escape") {
                            setRenamingFile(null);
                            setNewFileName("");
                          }
                        }}
                        placeholder="Enter new name..."
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => onRename(name, newFileName.trim())} disabled={isRenaming} className={`flex-1 bg-blue-600 text-white py-2 px-3 rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center justify-center gap-2 ${isRenaming ? "opacity-50 cursor-not-allowed" : ""}`}>
                        {isRenaming && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        Save
                      </button>
                      <button onClick={() => { setRenamingFile(null); setNewFileName(""); }} disabled={isRenaming} className="flex-1 bg-gray-600 text-gray-300 py-2 px-3 rounded-lg hover:bg-gray-500 text-sm font-medium disabled:opacity-50">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                        <div className={`w-8 h-8 sm:w-12 sm:h-12 rounded-xl ${fileIcon.bg} flex items-center justify-center text-sm sm:text-2xl flex-shrink-0 shadow-inner border border-white/5 group-hover:scale-105 transition-transform duration-300`}>{fileIcon.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <a href={getPublicUrl(name, file.lastModified)} target="_blank" rel="noreferrer" className="font-medium text-sm sm:text-base text-gray-200 hover:text-blue-400 truncate" title={name}>{name}</a>
                            {file.uploaded ? <div className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full font-medium flex-shrink-0">Uploaded</div> : uploadingFiles.has(name) ? <div className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-1 rounded-full font-medium flex-shrink-0">{Math.round(file.progress)}%</div> : <div className="bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded-full font-medium flex-shrink-0">Failed</div>}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-gray-500">{formatFileSize(file.size || file.blob?.size || 0)}</p>
                            <span className="text-gray-600">•</span>
                            <p className="text-xs text-gray-500">{new Date(file.lastModified).toLocaleDateString()}</p>
                          </div>
                          {!file.uploaded && uploadingFiles.has(name) && <div className="w-full bg-gray-600 rounded-full h-1.5 mt-2"><div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${file.progress}%` }} /></div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2 ml-2 sm:ml-4 flex-shrink-0">
                        {roomId && file.uploaded && <button onClick={() => onToggleDiscussion(name)} className={`relative p-1.5 sm:p-2 rounded-lg ${expandedFile === name ? "text-blue-400 bg-blue-400/10" : "text-gray-400 hover:text-blue-400 hover:bg-blue-400/10"}`} title="Discussion"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>{itemCounts[name] > 0 && <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white ring-2 ring-gray-900">{itemCounts[name] > 99 ? "99+" : itemCounts[name]}</span>}</button>}
                        {file.uploaded && <button onClick={() => onStartRename(name)} className="p-1.5 sm:p-2 text-gray-400 hover:text-yellow-400 hover:bg-yellow-400/10 rounded-lg" title="Rename file"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>}
                        <button onClick={() => onDelete(name)} className="p-1.5 sm:p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg" title="Delete file"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                      </div>
                    </div>
                    {roomId && expandedFile === name && <div className="mt-4 border-t border-gray-600 pt-3 h-96"><ItemDiscussion itemId={name} itemType="file" roomId={roomId} /></div>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {visibleCount < filteredFiles.length && <div ref={targetRef} className="h-10 w-full flex items-center justify-center mt-4"><div className="w-5 h-5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div></div>}
    </div>
  );
}
