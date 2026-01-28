"use client"

import type React from "react"
import { supabase } from "../../lib/supabase-client"
import { useAuthUser } from "../../hooks/useAuthUser"
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Dialog, type DialogProps } from "../UI/Dialog"
import ItemDiscussion from "./ItemDiscussion"
import { useItemCounts } from "../../hooks/useItemCounts"

type FileEntry = {
  name: string
  blob: Blob
  uploaded: boolean
  lastModified: number
  progress: number
  url?: string
  previewUrl?: string
  // Folder path prefix where this file lives (e.g., "room-123" or "users/abc" or legacy "abc")
  pathPrefix: string
}

type ImagesProps = {
  roomId?: string | null
}

const BUCKET = "user-images"

// Feature flags
const USE_NAMESPACED_PATHS = true // room-<roomId> or users/<userId>
const INCLUDE_LEGACY_LISTING = true // also list legacy "<roomId_or_userId>/" and merge

const isImageFile = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase()
  return !!ext && ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "tiff"].includes(ext)
}

const getBaseName = (fileName: string) => fileName.replace(/\.[^/.]+$/, "")

const isValidBaseName = (base: string) => /^[a-zA-Z0-9 _-]+$/.test(base)

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export default function Images({ roomId }: ImagesProps) {
  const user = useAuthUser()
  const navigate = useNavigate()

  const [files, setFiles] = useState<{ [key: string]: FileEntry }>({})
  const [searchTerm, setSearchTerm] = useState("")
  const [renamingFile, setRenamingFile] = useState<string | null>(null)
  const [newFileName, setNewFileName] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set())
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<Partial<DialogProps> & { isOpen: boolean }>({ isOpen: false, title: "" });

  // Real-time comment counts
  const itemCounts = useItemCounts(roomId, 'image');

  const prefixes = useMemo(() => {
    if (!user) return { primary: "", legacy: "" }
    if (USE_NAMESPACED_PATHS) {
      return {
        primary: roomId ? `room-${roomId}` : `${user.id}`,
        legacy: roomId ? `${roomId}` : `${user.id}`,
      }
    }
    // Legacy only
    const legacy = roomId ?? user.id
    return { primary: legacy as string, legacy: legacy as string }
  }, [user, roomId])

  const makePublicUrl = (pathPrefix: string, fileName: string) => {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(`${pathPrefix}/${fileName}`)
    return data.publicUrl
  }

  const toggleSelect = (name: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };



  const isSelected = (name: string) => selectedFiles.has(name);

  // Fetch files from Supabase Storage
  useEffect(() => {
    if (user === undefined) return
    if (!user) {
      navigate("/login")
      return
    }

    let cancelled = false
      ; (async () => {
        setIsLoading(true)
        try {
          const mergedFiles: { [key: string]: FileEntry } = {}

          // List primary prefix first
          const { data: primaryList, error: primaryErr } = await supabase.storage.from(BUCKET).list(prefixes.primary)
          if (primaryErr && primaryErr.message !== 'The resource was not found') {
            console.error("Failed to list primary prefix", primaryErr)
          } else if (primaryList) {
            primaryList.forEach((file) => {
              const fileName = file.name
              if (isImageFile(fileName)) {
                const publicUrl = makePublicUrl(prefixes.primary, fileName)
                mergedFiles[fileName] = {
                  name: fileName,
                  blob: new Blob(),
                  uploaded: true,
                  lastModified: new Date(file.updated_at || file.created_at || Date.now()).getTime(),
                  progress: 100,
                  url: publicUrl,
                  previewUrl: publicUrl,
                  pathPrefix: prefixes.primary,
                }
              }
            })
          }

          // Optionally list legacy and merge (skip duplicates, prefer primary)
          if (INCLUDE_LEGACY_LISTING && prefixes.legacy && prefixes.legacy !== prefixes.primary) {
            const { data: legacyList, error: legacyErr } = await supabase.storage.from(BUCKET).list(prefixes.legacy)
            if (legacyErr && legacyErr.message !== 'The resource was not found') {
              console.error("Failed to list legacy prefix", legacyErr)
            } else if (legacyList) {
              legacyList.forEach((file) => {
                const fileName = file.name
                if (isImageFile(fileName) && !mergedFiles[fileName]) {
                  const publicUrl = makePublicUrl(prefixes.legacy, fileName)
                  mergedFiles[fileName] = {
                    name: fileName,
                    blob: new Blob(),
                    uploaded: true,
                    lastModified: new Date(file.updated_at || file.created_at || Date.now()).getTime(),
                    progress: 100,
                    url: publicUrl,
                    previewUrl: publicUrl,
                    pathPrefix: prefixes.legacy,
                  }
                }
              })
            }
          }

          if (!cancelled) {
            setFiles(mergedFiles)
          }
        } finally {
          if (!cancelled) setIsLoading(false)
        }
      })()

    return () => {
      cancelled = true
    }
  }, [user, navigate, prefixes])

  // Revoke any blob: preview URLs on unmount or when files change
  useEffect(() => {
    return () => {
      Object.values(files).forEach((file) => {
        if (file.previewUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(file.previewUrl)
        }
      })
    }
  }, [files])



  const uploadToSupabase = async (fileEntry: FileEntry) => {
    if (!user) return

    const path = roomId ? `room-${roomId}/${fileEntry.name}` : `${user.id}/${fileEntry.name}`

    setUploadingFiles(prev => new Set(prev).add(fileEntry.name))

    try {
      let progress = 0
      const interval = setInterval(() => {
        progress += Math.random() * 15 + 5 // More realistic progress simulation
        setFiles((prev) => ({
          ...prev,
          [fileEntry.name]: {
            ...prev[fileEntry.name],
            progress: Math.min(progress, 95),
          },
        }))
      }, 200)

      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, fileEntry.blob, {
        upsert: true,
      })

      clearInterval(interval)

      if (!uploadError) {
        const pathPrefix = roomId ? `room-${roomId}` : `${user.id}`
        const publicUrl = makePublicUrl(pathPrefix, fileEntry.name)

        setFiles((prev) => ({
          ...prev,
          [fileEntry.name]: {
            ...fileEntry,
            uploaded: true,
            progress: 100,
            url: publicUrl,
            previewUrl: publicUrl,
            pathPrefix,
          },
        }))
      } else {
        console.error("Upload error:", uploadError)
        setFiles((prev) => ({
          ...prev,
          [fileEntry.name]: {
            ...prev[fileEntry.name],
            progress: 0,
          },
        }))
        // Better error notification
        const errorMsg = uploadError.message.includes('already exists')
          ? 'A file with this name already exists'
          : uploadError.message
        alert(`Upload failed: ${errorMsg}`)
      }
    } catch (err) {
      console.error("Upload exception:", err)
      alert(`Failed to upload ${fileEntry.name}`)
      setFiles((prev) => ({
        ...prev,
        [fileEntry.name]: {
          ...prev[fileEntry.name],
          progress: 0,
        },
      }))
    } finally {
      setUploadingFiles(prev => {
        const newSet = new Set(prev)
        newSet.delete(fileEntry.name)
        return newSet
      })
    }
  }

  // ---------- helpers ----------

  const sanitizeFileName = (name: string) => {
    const extIndex = name.lastIndexOf(".")
    const base = extIndex !== -1 ? name.slice(0, extIndex) : name
    const ext = extIndex !== -1 ? name.slice(extIndex) : ""

    const sanitizedBase = base
      .replace(/[^a-zA-Z0-9 _-]/g, "_") // remove special chars
      .replace(/\s+/g, " ")            // normalize spaces
      .replace(/_+/g, "_")             // collapse underscores
      .trim()
      .replace(/^_+|_+$/g, "")         // trim underscores

    return `${sanitizedBase || "file"}${ext}`
  }

  const getSafeUniqueName = (
    originalName: string,
    existing: Record<string, any>
  ) => {
    const sanitized = sanitizeFileName(originalName)

    if (!existing[sanitized]) return sanitized

    const extIndex = sanitized.lastIndexOf(".")
    const base = extIndex !== -1 ? sanitized.slice(0, extIndex) : sanitized
    const ext = extIndex !== -1 ? sanitized.slice(extIndex) : ""

    let i = 1
    let newName = `${base} (${i})${ext}`

    while (existing[newName]) {
      i++
      newName = `${base} (${i})${ext}`
    }

    return newName
  }

  const processFiles = async (filesInput: FileList | File[]) => {
    if (!user) return

    const validFiles: File[] = []
    const errors: string[] = []

    const fileList = Array.isArray(filesInput) ? filesInput : Array.from(filesInput)

    for (const file of fileList) {
      if (!isImageFile(file.name)) {
        errors.push(`"${file.name}" is not a valid image file`)
        continue
      }

      if (file.size > 10 * 1024 * 1024) {
        errors.push(`"${file.name}" is too large (max 10MB)`)
        continue
      }

      const safeName = getSafeUniqueName(file.name, files)

      const finalFile =
        safeName === file.name
          ? file
          : new File([file], safeName, { type: file.type })

      validFiles.push(finalFile)
    }

    if (errors.length > 0) {
      alert(`Some files could not be uploaded:\n${errors.join("\n")}`)
    }

    for (const file of validFiles) {
      const newEntry: FileEntry = {
        name: file.name,
        blob: file,
        uploaded: false,
        lastModified: file.lastModified,
        progress: 0,
        previewUrl: URL.createObjectURL(file),
        pathPrefix: prefixes.primary,
      }

      setFiles(prev => ({
        ...prev,
        [file.name]: newEntry,
      }))

      await uploadToSupabase(newEntry)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return

    await processFiles(fileList)
    e.currentTarget.value = ""
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)

    const fileList = e.dataTransfer.files
    if (!fileList || fileList.length === 0) return

    await processFiles(fileList)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    // Only set dragOver to false if we're leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOver(false)
    }
  }

  // Handle paste events
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      const pastedFiles: File[] = []
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile()
          if (file) {
            pastedFiles.push(file)
          }
        }
      }

      if (pastedFiles.length > 0) {
        e.preventDefault()
        await processFiles(pastedFiles)
      }
    }

    window.addEventListener("paste", handlePaste)
    return () => window.removeEventListener("paste", handlePaste)
  }, [processFiles])

  // Dialog Helpers
  const closeDialog = () => setDialog(prev => ({ ...prev, isOpen: false }));

  const handleDelete = (fileName: string) => {
    if (!user) return;

    setDialog({
      isOpen: true,
      title: "Delete Image",
      message: `Are you sure you want to delete "${fileName}"?`,
      type: "confirm",
      confirmText: "Delete",
      variant: "danger",
      onConfirm: async () => {
        const entry = files[fileName];
        const prefix = entry?.pathPrefix || prefixes.primary;

        const { error } = await supabase.storage.from(BUCKET).remove([`${prefix}/${fileName}`]);
        if (error) {
          alert(`Failed to delete file "${fileName}": ${error.message}`);
          closeDialog();
          return;
        }

        setFiles((prev) => {
          const updated = { ...prev };
          if (updated[fileName]?.previewUrl?.startsWith("blob:")) {
            URL.revokeObjectURL(updated[fileName].previewUrl!);
          }
          delete updated[fileName];
          return updated;
        });
        closeDialog();
      }
    });
  };

  const handleBulkDelete = async () => {
    if (selectedFiles.size === 0) return;

    setDialog({
      isOpen: true,
      title: "Delete Selected Images",
      message: `Delete ${selectedFiles.size} image(s)? This cannot be undone.`,
      type: "confirm",
      confirmText: "Delete All",
      variant: "danger",
      onConfirm: async () => {
        const names = Array.from(selectedFiles);

        // 1️⃣ Delete from storage
        const { error } = await supabase.storage
          .from("user-images")
          .remove(names.map(n => {
            const entry = files[n];
            const prefix = entry?.pathPrefix || prefixes.primary;
            return `${prefix}/${n}`;
          }));

        if (error) {
          console.error(error);
          alert("Failed to delete some images.");
          closeDialog();
          return;
        }

        // 2️⃣ Update UI immediately
        setFiles(prev => {
          const next = { ...prev };
          names.forEach(n => {
            if (next[n]?.previewUrl?.startsWith("blob:")) {
              URL.revokeObjectURL(next[n].previewUrl!);
            }
            delete next[n];
          });
          return next;
        });

        setSelectedFiles(new Set());
        closeDialog();
      }
    });
  };

  // ...
  const [isRenaming, setIsRenaming] = useState(false);

  const handleRename = async (oldName: string, newNameInput: string) => {
    if (!user) return
    if (isRenaming) return;

    if (!newNameInput || newNameInput === oldName) {
      setRenamingFile(null)
      setNewFileName("")
      return
    }

    // Preserve/append extension
    const oldExtIndex = oldName.lastIndexOf(".")
    const oldExt = oldExtIndex !== -1 ? oldName.slice(oldExtIndex) : ""
    const newExtIndex = newNameInput.lastIndexOf(".")
    const hasExtension = newExtIndex !== -1
    const newName = (hasExtension ? newNameInput : newNameInput + oldExt).trim()

    if (files[newName]) {
      alert(`File with name ${newName} already exists!`)
      return
    }
    if (!isImageFile(newName)) {
      alert("New file name must be a valid image file type.")
      return
    }
    const newBase = getBaseName(newName)
    if (!isValidBaseName(newBase)) {
      alert("Only letters, numbers, spaces, _ and - are allowed in the name.")
      return
    }

    setIsRenaming(true);
    try {
      const oldEntry = files[oldName]
      const prefix = oldEntry?.pathPrefix || prefixes.primary
      const oldPath = `${prefix}/${oldName}`
      const newPath = `${prefix}/${newName}`

      const { data: downloadData, error: downloadError } = await supabase.storage.from(BUCKET).download(oldPath)
      if (downloadError || !downloadData) {
        console.error("Download error:", downloadError)
        alert("Failed to download file for renaming")
        return
      }

      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(newPath, downloadData, {
        upsert: true,
      })
      if (uploadError) {
        console.error("Upload error:", uploadError)
        alert("Failed to upload file with new name")
        return
      }

      const { error: deleteError } = await supabase.storage.from(BUCKET).remove([oldPath])
      if (deleteError) {
        console.error("Delete error:", deleteError)
        alert(`Failed to delete old file "${oldName}": ${deleteError.message}`)
        return
      }

      const publicUrl = makePublicUrl(prefix, newName)
      setFiles((prev) => {
        const updatedFiles = { ...prev }
        const entry = updatedFiles[oldName]
        delete updatedFiles[oldName]
        updatedFiles[newName] = {
          ...(entry ?? {
            name: newName,
            blob: new Blob(),
            uploaded: true,
            lastModified: Date.now(),
            progress: 100,
          }),
          name: newName,
          previewUrl: publicUrl,
          url: publicUrl,
          pathPrefix: prefix,
        }
        return updatedFiles
      })
      setRenamingFile(null)
      setNewFileName("")
    } finally {
      setIsRenaming(false);
    }
  }



  if (user === undefined) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-800">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-600 border-t-blue-500"></div>
          <p className="text-gray-300 text-lg font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  const filteredFiles = Object.entries(files)
    .filter(([name]) => isImageFile(name))
    .filter(([name]) => name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort(([, a], [, b]) => b.lastModified - a.lastModified)

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 bg-gray-800 rounded-xl shadow-xl">
      <Dialog
        onClose={closeDialog}
        {...dialog}
        isOpen={dialog.isOpen}
        title={dialog.title || ""}
      />
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-bold text-white">
          {roomId ? `Room Images` : 'My Images'}
        </h2>
        <div className="text-sm text-gray-400">
          {filteredFiles.length} image{filteredFiles.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-4 sm:p-8 transition-all duration-300 ${dragOver
          ? 'border-blue-400 bg-blue-900/20'
          : 'border-gray-600 hover:border-gray-500 bg-gray-700/50'
          }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="text-center space-y-3 sm:space-y-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-gray-400">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <div>
            <p className="text-gray-300 text-base sm:text-lg font-medium">
              {dragOver ? 'Drop your images here' : 'Upload Images'}
            </p>
            <p className="text-gray-500 text-xs sm:text-sm mt-1">
              Drag & drop images or click to browse
            </p>
          </div>
          <label className="inline-block">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <span className="inline-flex items-center px-4 py-2 sm:px-6 sm:py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all duration-200 cursor-pointer text-sm sm:text-base">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Choose Files
            </span>
          </label>
          <p className="text-[10px] sm:text-xs text-gray-500">
            PNG, JPG, GIF, SVG, WEBP up to 10MB
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
          placeholder="Search images..."
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
            <p className="text-gray-400 font-medium">Loading images...</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredFiles.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto text-gray-500 mb-4">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-400 text-lg font-medium">
            {searchTerm ? 'No images match your search' : 'No images found'}
          </p>
          <p className="text-gray-500 text-sm mt-1">
            {searchTerm ? 'Try adjusting your search terms' : 'Upload some images to get started'}
          </p>
        </div>
      )}

      {selectedFiles.size > 0 && (
        <div className="sticky top-0 z-30 mb-4 flex items-center justify-between 
                  bg-gray-800/90 backdrop-blur-md border border-gray-700 
                  rounded-xl p-3 sm:p-4">
          <span className="text-sm text-gray-200">
            {selectedFiles.size} selected
          </span>

          <div className="flex gap-2">
            <button
              onClick={() => setSelectedFiles(new Set())}
              className="px-3 py-2 text-sm rounded-lg bg-gray-600 hover:bg-gray-500"
            >
              Clear
            </button>

            <button
              onClick={handleBulkDelete}
              className="px-3 py-2 sm:px-4 sm:py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white"
            >
              Delete selected
            </button>
          </div>
        </div>
      )}


      {/* Image Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
        {filteredFiles.map(([name, file]) => (
          <div
            key={name}
            onClick={() => toggleSelect(name)}
            className={`group rounded-xl shadow-lg transition-all duration-300 overflow-hidden border cursor-pointer
    ${isSelected(name)
                ? "bg-gray-800 border-blue-500 ring-2 ring-blue-500/40"
                : "bg-gray-700 border-gray-600/50 hover:shadow-xl"
              }`}
          >

            <div className="relative aspect-square">

              <img
                src={file.url || file.previewUrl}
                alt={name}
                className="w-full h-full object-cover cursor-pointer transition-transform duration-300 group-hover:scale-105"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImage(file.url || file.previewUrl || null);
                }}
                loading="lazy"
              />


              {/* Upload Progress Overlay */}
              {!file.uploaded && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/30 border-t-white mx-auto"></div>
                    <div className="bg-gray-800/80 rounded-full px-3 py-1">
                      <div className="text-white text-sm font-medium">{Math.round(file.progress)}%</div>
                    </div>
                    <div className="w-32 bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Chat Badge */}
              {itemCounts[name] > 0 && (
                <div className="absolute top-2 left-2 z-10">
                  <div className="bg-red-500/90 text-white text-xs px-2 py-1 rounded-full font-medium backdrop-blur-sm shadow-sm flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    {itemCounts[name] > 99 ? '99+' : itemCounts[name]}
                  </div>
                </div>
              )}

              {/* Status Badge */}
              <div className="absolute top-2 right-2">
                {file.uploaded ? (
                  <div className="bg-green-500/90 text-white text-xs px-2 py-1 rounded-full font-medium backdrop-blur-sm">
                    ✓ Uploaded
                  </div>
                ) : uploadingFiles.has(name) ? (
                  <div className="bg-yellow-500/90 text-white text-xs px-2 py-1 rounded-full font-medium backdrop-blur-sm">
                    ⏳ Uploading
                  </div>
                ) : null}
              </div>
            </div>

            <div className="p-4 space-y-3">
              {renamingFile === name ? (
                <div
                  className="space-y-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="text"
                    className="w-full p-2 rounded-lg border border-gray-600 bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
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
                    onClick={(e) => e.stopPropagation()}
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRename(name, newFileName.trim());
                      }}
                      disabled={isRenaming}
                      className={`flex-1 bg-blue-600 text-white py-2 px-3 rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm font-medium flex items-center justify-center gap-2 ${isRenaming ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      {isRenaming && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                      Save
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingFile(null);
                        setNewFileName("");
                      }}
                      disabled={isRenaming}
                      className="flex-1 bg-gray-600 text-gray-300 py-2 px-3 rounded-lg hover:bg-gray-500 transition-colors duration-200 text-sm font-medium disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <h3 className="font-medium text-gray-200 truncate" title={name}>
                      {name}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.blob?.size || 0)}
                    </p>
                  </div>

                  {file.uploaded && (
                    <div className="flex gap-2">
                      <a
                        href={makePublicUrl(file.pathPrefix, name)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 text-center bg-blue-600/20 text-blue-400 py-2 px-3 rounded-lg hover:bg-blue-600/30 transition-colors duration-200 text-sm font-medium"
                      >
                        Preview
                      </a>

                      <a
                        href={makePublicUrl(file.pathPrefix, name)}
                        download={name}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 text-center bg-green-600/20 text-green-400 py-2 px-3 rounded-lg hover:bg-green-600/30 transition-colors duration-200 text-sm font-medium"
                      >
                        Download
                      </a>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2 border-t border-gray-600">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingFile(name);
                        setNewFileName(getBaseName(name));
                      }}
                      className="p-2 text-gray-400 hover:text-yellow-400 hover:bg-yellow-400/10 rounded-lg transition-all duration-200"
                      title="Rename image"
                      disabled={!file.uploaded}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(name);
                      }}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all duration-200"
                      title="Delete image"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </div>

          </div>
        ))}
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="bg-gray-800 rounded-xl overflow-hidden max-w-6xl w-full max-h-[90vh] flex flex-col md:flex-row shadow-2xl border border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image Section */}
            <div className="flex-1 bg-black flex items-center justify-center p-4 min-h-[300px] md:min-h-0 relative">
              <img
                src={selectedImage}
                alt="Preview"
                className="max-w-full max-h-full object-contain"
              />
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors duration-200 z-10"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Discussion Section */}
            <div className="w-full md:w-[400px] bg-gray-800 border-t md:border-t-0 md:border-l border-gray-700 flex flex-col h-[400px] md:h-auto">
              <div className="p-4 border-b border-gray-700 bg-gray-800">
                <h3 className="text-lg font-semibold text-gray-200">Image Discussion</h3>
              </div>
              <div className="flex-1 overflow-hidden p-2">
                {(() => {
                  // Find the file name from the URL or state to use as itemId
                  // selectedImage is a URL. We need the name. 
                  // We can find the file object where URL matches selectedImage.
                  const fileEntry = Object.values(files).find(f => (f.url === selectedImage || f.previewUrl === selectedImage));
                  if (!fileEntry) return <div className="p-4 text-gray-500">Image not found</div>;

                  return (
                    <ItemDiscussion
                      itemId={fileEntry.name}
                      itemType="image"
                      roomId={roomId}
                    />
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}