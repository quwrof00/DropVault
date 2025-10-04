import { supabase } from "../../lib/supabase-client";
import { useAuthUser } from "../../hooks/useAuthUser";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

type FileEntry = {
  name: string;
  blob: Blob;
  uploaded: boolean;
  lastModified: number;
  progress: number;
  size?: number;
};

type FilesProps = {
  roomId?: string | null;
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const getFileIcon = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase();
  if (!ext) return { icon: "📁", color: "text-gray-400", bg: "bg-gray-500/20" };
  
  const iconMap: { [key: string]: { icon: string; color: string; bg: string } } = {
    // Images
    png: { icon: "🖼️", color: "text-purple-400", bg: "bg-purple-500/20" },
    jpg: { icon: "🖼️", color: "text-purple-400", bg: "bg-purple-500/20" },
    jpeg: { icon: "🖼️", color: "text-purple-400", bg: "bg-purple-500/20" },
    gif: { icon: "🖼️", color: "text-purple-400", bg: "bg-purple-500/20" },
    svg: { icon: "🖼️", color: "text-purple-400", bg: "bg-purple-500/20" },
    webp: { icon: "🖼️", color: "text-purple-400", bg: "bg-purple-500/20" },
    
    // Documents
    pdf: { icon: "📄", color: "text-red-400", bg: "bg-red-500/20" },
    doc: { icon: "📄", color: "text-blue-400", bg: "bg-blue-500/20" },
    docx: { icon: "📄", color: "text-blue-400", bg: "bg-blue-500/20" },
    txt: { icon: "📄", color: "text-gray-400", bg: "bg-gray-500/20" },
    rtf: { icon: "📄", color: "text-gray-400", bg: "bg-gray-500/20" },
    
    // Archives
    zip: { icon: "🗜️", color: "text-yellow-400", bg: "bg-yellow-500/20" },
    rar: { icon: "🗜️", color: "text-yellow-400", bg: "bg-yellow-500/20" },
    "7z": { icon: "🗜️", color: "text-yellow-400", bg: "bg-yellow-500/20" },
    
    // Videos
    mp4: { icon: "🎥", color: "text-green-400", bg: "bg-green-500/20" },
    mov: { icon: "🎥", color: "text-green-400", bg: "bg-green-500/20" },
    avi: { icon: "🎥", color: "text-green-400", bg: "bg-green-500/20" },
    
    // Audio
    mp3: { icon: "🎵", color: "text-pink-400", bg: "bg-pink-500/20" },
    wav: { icon: "🎵", color: "text-pink-400", bg: "bg-pink-500/20" },
    
    // Code
    js: { icon: "💻", color: "text-yellow-400", bg: "bg-yellow-500/20" },
    ts: { icon: "💻", color: "text-blue-400", bg: "bg-blue-500/20" },
    jsx: { icon: "💻", color: "text-cyan-400", bg: "bg-cyan-500/20" },
    tsx: { icon: "💻", color: "text-cyan-400", bg: "bg-cyan-500/20" },
    py: { icon: "💻", color: "text-green-400", bg: "bg-green-500/20" },
    html: { icon: "💻", color: "text-orange-400", bg: "bg-orange-500/20" },
    css: { icon: "💻", color: "text-blue-400", bg: "bg-blue-500/20" },
    json: { icon: "💻", color: "text-gray-400", bg: "bg-gray-500/20" },
  };

  return iconMap[ext] || { icon: "📁", color: "text-gray-400", bg: "bg-gray-500/20" };
};

const isValidFileName = (name: string) => {
  const nameWithoutExtension = name.replace(/\.[^/.]+$/, "");
  return /^[a-zA-Z0-9 _-]+$/.test(nameWithoutExtension);
};

export default function Files({ roomId }: FilesProps) {
  const user = useAuthUser();
  const navigate = useNavigate();
  const [files, setFiles] = useState<{ [key: string]: FileEntry }>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());

  const progressIntervals = useRef<{ [key: string]: NodeJS.Timeout }>({});

  useEffect(() => {
    if (user === undefined) return;
    if (!user) {
      navigate("/login");
      return;
    }

    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const folderPath = roomId ? `room-${roomId}` : user.id;
        
        const { data: supabaseFiles, error } = await supabase.storage
          .from("user-files")
          .list(folderPath);

        if (error && error.message !== 'The resource was not found') {
          console.error("Failed to fetch Supabase files", error);
        }

        const mergedFiles: { [key: string]: FileEntry } = {};

        supabaseFiles?.forEach((file) => {
          mergedFiles[file.name] = {
            name: file.name,
            blob: new Blob(),
            uploaded: true,
            lastModified: new Date(file.updated_at || file.created_at || Date.now()).getTime(),
            progress: 100,
            size: file.metadata?.size || 0,
          };
        });

        if (!cancelled) {
          setFiles(mergedFiles);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, navigate, roomId]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(progressIntervals.current).forEach(clearInterval);
    };
  }, []);

  if (user === undefined) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-800">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-600 border-t-blue-500"></div>
          <p className="text-gray-300 text-lg font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  const getPublicUrl = (fileName: string) => {
    if (!user) return;
    const folderPath = roomId ? `room-${roomId}` : user.id;
    const { data } = supabase.storage
      .from("user-files")
      .getPublicUrl(`${folderPath}/${fileName}`);
    return data.publicUrl;
  };

  const uploadToSupabase = async (fileEntry: FileEntry) => {
    if (!user) return;
    const folderPath = roomId ? `room-${roomId}` : user.id;
    const path = `${folderPath}/${fileEntry.name}`;

    setUploadingFiles(prev => new Set(prev).add(fileEntry.name));

    try {
      const { error } = await supabase.storage
        .from("user-files")
        .upload(path, fileEntry.blob, { upsert: true });

      if (error) {
        console.error("Upload error:", error);
        const errorMsg = error.message.includes('already exists') 
          ? 'A file with this name already exists'
          : error.message;
        alert(`Failed to upload ${fileEntry.name}: ${errorMsg}`);
        
        setFiles((prev) => {
          const updated = { ...prev };
          delete updated[fileEntry.name];
          return updated;
        });
        return;
      }

      setFiles((prev) => ({
        ...prev,
        [fileEntry.name]: { ...fileEntry, uploaded: true, progress: 100, size: fileEntry.blob.size },
      }));
    } catch (err) {
      console.error("Upload exception:", err);
      alert(`Failed to upload ${fileEntry.name}`);
      setFiles((prev) => {
        const updated = { ...prev };
        delete updated[fileEntry.name];
        return updated;
      });
    } finally {
      if (progressIntervals.current[fileEntry.name]) {
        clearInterval(progressIntervals.current[fileEntry.name]);
        delete progressIntervals.current[fileEntry.name];
      }
      setUploadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileEntry.name);
        return newSet;
      });
    }
  };

  const processFiles = async (fileList: FileList) => {
    if (!user) return;

    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of Array.from(fileList)) {
      if (files[file.name]) {
        errors.push(`File "${file.name}" already exists`);
        continue;
      }

      if (!isValidFileName(file.name)) {
        errors.push(`"${file.name}" contains invalid characters. Only letters, numbers, spaces, _ and - are allowed`);
        continue;
      }

      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        errors.push(`"${file.name}" is too large (max 50MB)`);
        continue;
      }

      validFiles.push(file);
    }

    if (errors.length > 0) {
      alert(`Some files could not be uploaded:\n${errors.join('\n')}`);
    }

    // Process valid files
    for (const file of validFiles) {
      const newEntry: FileEntry = {
        name: file.name,
        blob: file,
        uploaded: false,
        lastModified: file.lastModified,
        progress: 0,
        size: file.size,
      };

      setFiles((prev) => ({
        ...prev,
        [file.name]: newEntry,
      }));

      // Start progress animation
      let progress = 0;
      progressIntervals.current[file.name] = setInterval(() => {
        progress += Math.random() * 15 + 5;
        setFiles((prev) => ({
          ...prev,
          [file.name]: {
            ...prev[file.name],
            progress: Math.min(progress, 95),
          },
        }));
      }, 200);

      await uploadToSupabase(newEntry);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    await processFiles(fileList);
    e.currentTarget.value = "";
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    
    const fileList = e.dataTransfer.files;
    if (!fileList || fileList.length === 0) return;
    
    await processFiles(fileList);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOver(false);
    }
  };

  const handleDelete = async (fileName: string) => {
    if (!user || !confirm(`Are you sure you want to delete "${fileName}"?`)) return;

    const folderPath = roomId ? `room-${roomId}` : user.id;
    const { error } = await supabase.storage
      .from("user-files")
      .remove([`${folderPath}/${fileName}`]);

    if (error) {
      alert(`Failed to delete file "${fileName}": ${error.message}`);
      return;
    }

    setFiles((prev) => {
      const updated = { ...prev };
      delete updated[fileName];
      return updated;
    });
  };

  const handleRename = async (oldName: string, newNameInput: string) => {
    if (!user) return;
    if (!newNameInput || newNameInput === oldName) {
      setRenamingFile(null);
      setNewFileName("");
      return;
    }

    const oldExtIndex = oldName.lastIndexOf(".");
    const oldExt = oldExtIndex !== -1 ? oldName.slice(oldExtIndex) : "";
    const newExtIndex = newNameInput.lastIndexOf(".");
    const hasExtension = newExtIndex !== -1;
    const newName = (hasExtension ? newNameInput : newNameInput + oldExt).trim();

    if (files[newName]) {
      alert(`File with name "${newName}" already exists!`);
      return;
    }

    if (!isValidFileName(newName)) {
      alert("Only letters, numbers, spaces, _ and - are allowed in the name.");
      return;
    }

    const folderPath = roomId ? `room-${roomId}` : user.id;
    const oldPath = `${folderPath}/${oldName}`;
    const newPath = `${folderPath}/${newName}`;

    const { data: downloadData, error: downloadError } = await supabase.storage
      .from("user-files")
      .download(oldPath);

    if (downloadError || !downloadData) {
      console.error("Download error:", downloadError);
      alert("Failed to download file for renaming");
      return;
    }

    const { error: uploadError } = await supabase.storage
      .from("user-files")
      .upload(newPath, downloadData, { upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      alert("Failed to upload file with new name");
      return;
    }

    const { error: deleteError } = await supabase.storage
      .from("user-files")
      .remove([oldPath]);

    if (deleteError) {
      console.error("Delete error:", deleteError);
      alert("Failed to delete old file after renaming");
      return;
    }

    setFiles((prev) => {
      const updatedFiles = { ...prev };
      const entry = updatedFiles[oldName];
      delete updatedFiles[oldName];
      updatedFiles[newName] = {
        ...entry,
        name: newName,
      };
      return updatedFiles;
    });

    setRenamingFile(null);
    setNewFileName("");
  };

  const filteredFiles = Object.entries(files)
    .filter(([name]) => name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort(([, a], [, b]) => b.lastModified - a.lastModified);

  return (
    <div className="p-6 space-y-6 bg-gray-800 rounded-xl shadow-xl max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">
          {roomId ? `Room Files` : 'My Files'}
        </h2>
        <div className="text-sm text-gray-400">
          {filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-8 transition-all duration-300 ${
          dragOver 
            ? 'border-blue-400 bg-blue-900/20' 
            : 'border-gray-600 hover:border-gray-500 bg-gray-700/50'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto text-gray-400">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <p className="text-gray-300 text-lg font-medium">
              {dragOver ? 'Drop your files here' : 'Upload Files'}
            </p>
            <p className="text-gray-500 text-sm mt-1">
              Drag & drop files or click to browse
            </p>
          </div>
          <label className="inline-block">
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <span className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all duration-200 cursor-pointer">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Choose Files
            </span>
          </label>
          <p className="text-xs text-gray-500">
            Any file type up to 50MB
          </p>
        </div>
      </div>

      {/* Search Bar */}
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
          className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-600 bg-gray-700 text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
        />
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-600 border-t-blue-500"></div>
            <p className="text-gray-400 font-medium">Loading files...</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredFiles.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto text-gray-500 mb-4">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-400 text-lg font-medium">
            {searchTerm ? 'No files match your search' : 'No files found'}
          </p>
          <p className="text-gray-500 text-sm mt-1">
            {searchTerm ? 'Try adjusting your search terms' : 'Upload some files to get started'}
          </p>
        </div>
      )}

      {/* Files List */}
      <div className="space-y-3">
        {filteredFiles.map(([name, file]) => {
          const fileIcon = getFileIcon(name);
          return (
            <div
              key={name}
              className="group bg-gray-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-600/50 overflow-hidden"
            >
              <div className="p-4">
                {renamingFile === name ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${fileIcon.bg} flex items-center justify-center text-lg`}>
                        {fileIcon.icon}
                      </div>
                      <input
                        type="text"
                        className="flex-1 p-2 rounded-lg border border-gray-600 bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleRename(name, newFileName.trim());
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
                      <button
                        onClick={() => handleRename(name, newFileName.trim())}
                        className="flex-1 bg-blue-600 text-white py-2 px-3 rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm font-medium"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setRenamingFile(null);
                          setNewFileName("");
                        }}
                        className="flex-1 bg-gray-600 text-gray-300 py-2 px-3 rounded-lg hover:bg-gray-500 transition-colors duration-200 text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-lg ${fileIcon.bg} flex items-center justify-center text-lg flex-shrink-0`}>
                        {fileIcon.icon}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <a
                            href={getPublicUrl(name)}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-gray-200 hover:text-blue-400 transition-colors duration-200 truncate"
                            title={name}
                          >
                            {name}
                          </a>
                          
                          {/* Status Badge */}
                          {file.uploaded ? (
                            <div className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full font-medium flex-shrink-0">
                              ✓ Uploaded
                            </div>
                          ) : uploadingFiles.has(name) ? (
                            <div className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-1 rounded-full font-medium flex-shrink-0">
                              ⏳ {Math.round(file.progress)}%
                            </div>
                          ) : (
                            <div className="bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded-full font-medium flex-shrink-0">
                              ✗ Failed
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-gray-500">
                            {formatFileSize(file.size || file.blob?.size || 0)}
                          </p>
                          <span className="text-gray-600">•</span>
                          <p className="text-xs text-gray-500">
                            {new Date(file.lastModified).toLocaleDateString()}
                          </p>
                        </div>
                        
                        {/* Progress Bar for Uploading Files */}
                        {!file.uploaded && uploadingFiles.has(name) && (
                          <div className="w-full bg-gray-600 rounded-full h-1.5 mt-2">
                            <div
                              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${file.progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                      {file.uploaded && (
                        <>
                          <a
                            href={getPublicUrl(name)}
                            download={name}
                            className="p-2 text-gray-400 hover:text-green-400 hover:bg-green-400/10 rounded-lg transition-all duration-200"
                            title="Download file"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </a>
                          
                          <button
                            onClick={() => {
                              setRenamingFile(name);
                              setNewFileName(name.replace(/\.[^/.]+$/, ""));
                            }}
                            className="p-2 text-gray-400 hover:text-yellow-400 hover:bg-yellow-400/10 rounded-lg transition-all duration-200"
                            title="Rename file"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </>
                      )}
                      
                      <button
                        onClick={() => handleDelete(name)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all duration-200"
                        title="Delete file"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}