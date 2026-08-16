export type StoredFileEntry = {
  name: string;
  blob: Blob;
  uploaded: boolean;
  lastModified: number;
  progress: number;
  size?: number;
};

export const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))}${sizes[i]}`;
};

export const getFileIcon = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase();
  if (!ext) return { icon: "📁", color: "text-gray-400", bg: "bg-gray-500/20" };

  const iconMap: Record<string, { icon: string; color: string; bg: string }> = {
    png: { icon: "🖼️", color: "text-purple-400", bg: "bg-purple-500/20" },
    jpg: { icon: "🖼️", color: "text-purple-400", bg: "bg-purple-500/20" },
    jpeg: { icon: "🖼️", color: "text-purple-400", bg: "bg-purple-500/20" },
    gif: { icon: "🖼️", color: "text-purple-400", bg: "bg-purple-500/20" },
    svg: { icon: "🖼️", color: "text-purple-400", bg: "bg-purple-500/20" },
    webp: { icon: "🖼️", color: "text-purple-400", bg: "bg-purple-500/20" },
    pdf: { icon: "📄", color: "text-red-400", bg: "bg-red-500/20" },
    doc: { icon: "📄", color: "text-blue-400", bg: "bg-blue-500/20" },
    docx: { icon: "📄", color: "text-blue-400", bg: "bg-blue-500/20" },
    txt: { icon: "📄", color: "text-gray-400", bg: "bg-gray-500/20" },
    rtf: { icon: "📄", color: "text-gray-400", bg: "bg-gray-500/20" },
    zip: { icon: "🗜️", color: "text-yellow-400", bg: "bg-yellow-500/20" },
    rar: { icon: "🗜️", color: "text-yellow-400", bg: "bg-yellow-500/20" },
    "7z": { icon: "🗜️", color: "text-yellow-400", bg: "bg-yellow-500/20" },
    mp4: { icon: "🎥", color: "text-green-400", bg: "bg-green-500/20" },
    mov: { icon: "🎥", color: "text-green-400", bg: "bg-green-500/20" },
    avi: { icon: "🎥", color: "text-green-400", bg: "bg-green-500/20" },
    mp3: { icon: "🎵", color: "text-pink-400", bg: "bg-pink-500/20" },
    wav: { icon: "🎵", color: "text-pink-400", bg: "bg-pink-500/20" },
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

export const isValidFileName = (name: string) => {
  const nameWithoutExtension = name.replace(/\.[^/.]+$/, "");
  return /^[a-zA-Z0-9 _-]+$/.test(nameWithoutExtension);
};

export const sanitizeFileName = (name: string) => {
  const extIndex = name.lastIndexOf(".");
  const base = extIndex !== -1 ? name.slice(0, extIndex) : name;
  const ext = extIndex !== -1 ? name.slice(extIndex) : "";

  const sanitizedBase = base
    .replace(/[^a-zA-Z0-9 _-]/g, "_")
    .replace(/\s+/g, "")
    .replace(/_+/g, "_")
    .trim()
    .replace(/^_+|_+$/g, "");

  return `${sanitizedBase || "file"}${ext}`;
};

export const getSafeUniqueName = (
  originalName: string,
  existing: Record<string, unknown>,
) => {
  const sanitized = sanitizeFileName(originalName);

  if (!existing[sanitized]) return sanitized;

  const extIndex = sanitized.lastIndexOf(".");
  const base = extIndex !== -1 ? sanitized.slice(0, extIndex) : sanitized;
  const ext = extIndex !== -1 ? sanitized.slice(extIndex) : "";

  let i = 1;
  let newName = `${base} (${i})${ext}`;

  while (existing[newName]) {
    i++;
    newName = `${base} (${i})${ext}`;
  }

  return newName;
};
