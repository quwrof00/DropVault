"use client"

import type React from "react"
import { supabase } from "../../lib/supabase-client"
import { useAuthUser } from "../../hooks/useAuthUser"
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

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

  // Fetch files from Supabase Storage
  useEffect(() => {
    if (user === undefined) return
    if (!user) {
      navigate("/login")
      return
    }

    let cancelled = false
    ;(async () => {
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

  const processFiles = async (fileList: FileList) => {
    if (!user) return

    const validFiles: File[] = []
    const errors: string[] = []

    for (const file of Array.from(fileList)) {
      if (files[file.name]) {
        errors.push(`File "${file.name}" already exists`)
        continue
      }

      const nameWithoutExtension = getBaseName(file.name).trim()
      if (!isValidBaseName(nameWithoutExtension)) {
        errors.push(`"${file.name}" contains invalid characters. Only letters, numbers, spaces, _ and - are allowed`)
        continue
      }

      if (!isImageFile(file.name)) {
        errors.push(`"${file.name}" is not a valid image file`)
        continue
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        errors.push(`"${file.name}" is too large (max 10MB)`)
        continue
      }

      validFiles.push(file)
    }

    if (errors.length > 0) {
      alert(`Some files could not be uploaded:\n${errors.join('\n')}`)
    }

    // Process valid files
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

      setFiles((prev) => ({
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

  const handleDelete = async (fileName: string) => {
    if (!user || !confirm(`Delete "${fileName}"?`)) return
    const entry = files[fileName]
    const prefix = entry?.pathPrefix || prefixes.primary

    const { error } = await supabase.storage.from(BUCKET).remove([`${prefix}/${fileName}`])
    if (error) {
      alert(`Failed to delete file "${fileName}": ${error.message}`)
      return
    }

    setFiles((prev) => {
      const updated = { ...prev }
      if (updated[fileName]?.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(updated[fileName].previewUrl!)
      }
      delete updated[fileName]
      return updated
    })
  }

  const handleRename = async (oldName: string, newNameInput: string) => {
    if (!user) return
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
  }

  const filteredFiles = Object.entries(files)
    .filter(([name]) => isImageFile(name))
    .filter(([name]) => name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort(([, a], [, b]) => b.lastModified - a.lastModified)

  return (
    <div className="p-6 space-y-6 bg-gray-800 rounded-xl shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">
          {roomId ? `Room Images` : 'My Images'}
        </h2>
        <div className="text-sm text-gray-400">
          {filteredFiles.length} image{filteredFiles.length !== 1 ? 's' : ''}
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
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <div>
            <p className="text-gray-300 text-lg font-medium">
              {dragOver ? 'Drop your images here' : 'Upload Images'}
            </p>
            <p className="text-gray-500 text-sm mt-1">
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
            <span className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all duration-200 cursor-pointer">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Choose Files
            </span>
          </label>
          <p className="text-xs text-gray-500">
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

      {/* Image Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredFiles.map(([name, file]) => (
          <div
            key={name}
            className="group bg-gray-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-600/50"
          >
            <div className="relative aspect-square">
              <img 
                src={file.url || file.previewUrl} 
                alt={name} 
                className="w-full h-full object-cover cursor-pointer transition-transform duration-300 group-hover:scale-105"
                onClick={() => setSelectedImage(file.url || file.previewUrl || null)}
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
                <div className="space-y-2">
                  <input
                    type="text"
                    className="w-full p-2 rounded-lg border border-gray-600 bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleRename(name, newFileName.trim())
                      }
                      if (e.key === "Escape") {
                        setRenamingFile(null)
                        setNewFileName("")
                      }
                    }}
                    placeholder="Enter new name..."
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRename(name, newFileName.trim())}
                      className="flex-1 bg-blue-600 text-white py-2 px-3 rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm font-medium"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setRenamingFile(null)
                        setNewFileName("")
                      }}
                      className="flex-1 bg-gray-600 text-gray-300 py-2 px-3 rounded-lg hover:bg-gray-500 transition-colors duration-200 text-sm font-medium"
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
                        className="flex-1 text-center bg-blue-600/20 text-blue-400 py-2 px-3 rounded-lg hover:bg-blue-600/30 transition-colors duration-200 text-sm font-medium"
                      >
                        Preview
                      </a>
                      <a
                        href={makePublicUrl(file.pathPrefix, name)}
                        download={name}
                        className="flex-1 text-center bg-green-600/20 text-green-400 py-2 px-3 rounded-lg hover:bg-green-600/30 transition-colors duration-200 text-sm font-medium"
                      >
                        Download
                      </a>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2 border-t border-gray-600">
                    <button
                      onClick={() => {
                        setRenamingFile(name)
                        setNewFileName(getBaseName(name))
                      }}
                      className="p-2 text-gray-400 hover:text-yellow-400 hover:bg-yellow-400/10 rounded-lg transition-all duration-200"
                      title="Rename image"
                      disabled={!file.uploaded}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(name)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all duration-200"
                      title="Delete image"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <img 
              src={selectedImage} 
              alt="Preview" 
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors duration-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}