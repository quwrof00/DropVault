import type React from "react";
import { Dialog, type DialogProps } from "../../UI/Dialog";
import ItemDiscussion from "../ItemDiscussion";
import { formatFileSize, getBaseName, makeImagePublicUrl, type ImageFileEntry } from "./helpers";

type ImagesViewProps = {
  roomId?: string | null;
  dragOver: boolean;
  isLoading: boolean;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  selectedImage: string | null;
  setSelectedImage: (value: string | null) => void;
  selectedFiles: Set<string>;
  setSelectedFiles: (value: Set<string>) => void;
  filteredFiles: Array<[string, ImageFileEntry]>;
  visibleCount: number;
  targetRef: (node?: Element | null) => void;
  files: Record<string, ImageFileEntry>;
  itemCounts: Record<string, number>;
  uploadingFiles: Set<string>;
  renamingFile: string | null;
  newFileName: string;
  setNewFileName: (value: string) => void;
  setRenamingFile: (value: string | null) => void;
  isRenaming: boolean;
  dialog: Partial<DialogProps> & { isOpen: boolean };
  closeDialog: () => void;
  toggleSelect: (name: string) => void;
  isSelected: (name: string) => boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void | Promise<void>;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onDelete: (name: string) => void;
  onBulkDelete: () => void;
  onRename: (oldName: string, newName: string) => void | Promise<void>;
};

export default function ImagesView(props: ImagesViewProps) {
  const {
    roomId,
    dragOver,
    isLoading,
    searchTerm,
    setSearchTerm,
    selectedImage,
    setSelectedImage,
    selectedFiles,
    setSelectedFiles,
    filteredFiles,
    visibleCount,
    targetRef,
    files,
    itemCounts,
    uploadingFiles,
    renamingFile,
    newFileName,
    setNewFileName,
    setRenamingFile,
    isRenaming,
    dialog,
    closeDialog,
    toggleSelect,
    isSelected,
    onFileChange,
    onDrop,
    onDragOver,
    onDragLeave,
    onDelete,
    onBulkDelete,
    onRename,
  } = props;

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 bg-gray-800 rounded-xl shadow-xl">
      <Dialog onClose={closeDialog} {...dialog} isOpen={dialog.isOpen} title={dialog.title || ""} />
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-bold text-white">{roomId ? "Room Images" : "My Images"}</h2>
        <div className="text-sm text-gray-400">{filteredFiles.length} image{filteredFiles.length !== 1 ? "s" : ""}</div>
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <div>
            <p className="text-gray-300 text-base sm:text-lg font-medium">{dragOver ? "Drop your images here" : "Upload Images"}</p>
            <p className="text-gray-500 text-xs sm:text-sm mt-1">Drag & drop images or click to browse</p>
          </div>
          <label className="inline-block">
            <input type="file" accept="image/*" multiple onChange={onFileChange} className="hidden" />
            <span className="inline-flex items-center px-4 py-2 sm:px-6 sm:py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 cursor-pointer text-sm sm:text-base">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Choose Files
            </span>
          </label>
          <p className="text-[10px] sm:text-xs text-gray-500">PNG, JPG, GIF, SVG, WEBP up to 10MB</p>
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
          placeholder="Search images..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-600 bg-gray-700 text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-600 border-t-blue-500"></div>
            <p className="text-gray-400 font-medium">Loading images...</p>
          </div>
        </div>
      )}

      {!isLoading && filteredFiles.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto text-gray-500 mb-4">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-400 text-lg font-medium">{searchTerm ? "No images match your search" : "No images found"}</p>
          <p className="text-gray-500 text-sm mt-1">{searchTerm ? "Try adjusting your search terms" : "Upload some images to get started"}</p>
        </div>
      )}

      {selectedFiles.size > 0 && (
        <div className="sticky top-0 z-30 mb-4 flex items-center justify-between bg-gray-800/90 backdrop-blur-md border border-gray-700 rounded-xl p-3 sm:p-4">
          <span className="text-sm text-gray-200">{selectedFiles.size} selected</span>
          <div className="flex gap-2">
            <button onClick={() => setSelectedFiles(new Set())} className="px-3 py-2 text-sm rounded-lg bg-gray-600 hover:bg-gray-500">Clear</button>
            <button onClick={onBulkDelete} className="px-3 py-2 sm:px-4 sm:py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white">Delete selected</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
        {filteredFiles.slice(0, visibleCount).map(([name, file]) => (
          <div key={name} onClick={() => toggleSelect(name)} className={`group rounded-xl shadow-lg overflow-hidden border cursor-pointer ${isSelected(name) ? "bg-gray-800 border-blue-500 ring-2 ring-blue-500/40" : "bg-gray-700 border-gray-600/50 hover:shadow-xl"}`}>
            <div className="relative aspect-square">
              <img src={file.thumbnailUrl || file.previewUrl || file.url} alt={name} className="w-full h-full object-cover cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelectedImage(file.url || file.previewUrl || null); }} loading="lazy" />
              {!file.uploaded && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><div className="text-center space-y-3"><div className="animate-spin rounded-full h-8 w-8 border-2 border-white/30 border-t-white mx-auto"></div><div className="bg-gray-800/80 rounded-full px-3 py-1"><div className="text-white text-sm font-medium">{Math.round(file.progress)}%</div></div><div className="w-32 bg-gray-700 rounded-full h-2"><div className="bg-blue-500 h-2 rounded-full" style={{ width: `${file.progress}%` }} /></div></div></div>}
              {itemCounts[name] > 0 && <div className="absolute top-2 left-2 z-10"><div className="bg-red-500/90 text-white text-xs px-2 py-1 rounded-full font-medium backdrop-blur-sm shadow-sm flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>{itemCounts[name] > 99 ? "99+" : itemCounts[name]}</div></div>}
              <div className="absolute top-2 right-2">{file.uploaded ? <div className="bg-green-500/90 text-white text-xs px-2 py-1 rounded-full font-medium backdrop-blur-sm">Uploaded</div> : uploadingFiles.has(name) ? <div className="bg-yellow-500/90 text-white text-xs px-2 py-1 rounded-full font-medium backdrop-blur-sm">Uploading</div> : null}</div>
            </div>
            <div className="p-4 space-y-3">
              {renamingFile === name ? (
                <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                  <input type="text" className="w-full p-2 rounded-lg border border-gray-600 bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500" value={newFileName} onChange={(e) => setNewFileName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onRename(name, newFileName.trim()); } if (e.key === "Escape") { setRenamingFile(null); setNewFileName(""); } }} placeholder="Enter new name..." autoFocus onClick={(e) => e.stopPropagation()} />
                  <div className="flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); onRename(name, newFileName.trim()); }} disabled={isRenaming} className={`flex-1 bg-blue-600 text-white py-2 px-3 rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center justify-center gap-2 ${isRenaming ? "opacity-50 cursor-not-allowed" : ""}`}>{isRenaming && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}Save</button>
                    <button onClick={(e) => { e.stopPropagation(); setRenamingFile(null); setNewFileName(""); }} disabled={isRenaming} className="flex-1 bg-gray-600 text-gray-300 py-2 px-3 rounded-lg hover:bg-gray-500 text-sm font-medium disabled:opacity-50">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <h3 className="font-medium text-gray-200 truncate" title={name}>{name}</h3>
                    <p className="text-xs text-gray-500">{formatFileSize(file.blob?.size || 0)}</p>
                  </div>
                  {file.uploaded && <div className="flex gap-2"><a href={makeImagePublicUrl(file.pathPrefix, name)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex-1 text-center bg-blue-600/20 text-blue-400 py-2 px-3 rounded-lg hover:bg-blue-600/30 text-sm font-medium">Preview</a></div>}
                  <div className="flex justify-between items-center pt-2 border-t border-gray-600">
                    <button onClick={(e) => { e.stopPropagation(); setRenamingFile(name); setNewFileName(getBaseName(name)); }} className="p-2 text-gray-400 hover:text-yellow-400 hover:bg-yellow-400/10 rounded-lg" title="Rename image" disabled={!file.uploaded}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(name); }} className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg" title="Delete image"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {visibleCount < filteredFiles.length && <div ref={targetRef} className="h-10 w-full flex items-center justify-center"><div className="w-5 h-5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div></div>}

      {selectedImage && <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setSelectedImage(null)}><div className="bg-gray-800 rounded-xl overflow-hidden max-w-6xl w-full max-h-[90vh] flex flex-col md:flex-row shadow-2xl border border-gray-700" onClick={(e) => e.stopPropagation()}><div className="flex-1 bg-black flex items-center justify-center p-4 min-h-[300px] md:min-h-0 relative"><img src={selectedImage} alt="Preview" className="max-w-full max-h-full object-contain" /><button onClick={() => setSelectedImage(null)} className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 z-10"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div>{roomId && <div className="w-full md:w-[400px] bg-gray-800 border-t md:border-t-0 md:border-l border-gray-700 flex flex-col h-[400px] md:h-auto"><div className="p-4 border-b border-gray-700 bg-gray-800"><h3 className="text-lg font-semibold text-gray-200">Image Discussion</h3></div><div className="flex-1 overflow-hidden p-2">{(() => { const fileEntry = Object.values(files).find((f) => f.url === selectedImage || f.previewUrl === selectedImage); if (!fileEntry) return <div className="p-4 text-gray-500">Image not found</div>; return <ItemDiscussion itemId={fileEntry.name} itemType="image" roomId={roomId} />; })()}</div></div>}</div></div>}
    </div>
  );
}
