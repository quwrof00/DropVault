import React, { useState, useMemo } from "react";
import { Menu, Plus, Search, Pencil, Trash2, Folder, File, ChevronRight, ChevronDown, FolderPlus, FileText } from "lucide-react";

interface SidebarProps {
  search: string;
  setSearch: (value: string) => void;
  items: string[];
  onCreate: (path?: string) => void; // Updated to accept optional path
  onCreateFolder?: () => void;
  onSelect: (name: string) => void;
  onRename: (name: string) => void;
  onDelete: (name: string) => void;
  onCreateFileInFolder?: (folderPath: string) => void;
  currentItem: string;
  typeLabel: string;
  isCreating: boolean;

  // New props for mobile control
  isOpen?: boolean; // Controlled by parent on mobile
  onClose?: () => void; // To close the sidebar
}

interface TreeNode {
  name: string;
  fullPath: string;
  type: 'file' | 'folder';
  children?: TreeNode[];
}

const SubSidebar: React.FC<SidebarProps> = ({
  search,
  setSearch,
  items,
  onCreate,
  onCreateFolder,
  onSelect,
  onRename,
  onDelete,
  onCreateFileInFolder,
  currentItem,
  typeLabel,
  isCreating,
  isOpen = false, // Default closed on mobile if not specified
  onClose
}) => {
  const [isDesktopOpen, setIsDesktopOpen] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'folders' | 'files'>('folders'); // 'folders' (Tree) | 'files' (Stray/Root only)

  // Build tree structure
  const treeStructure = useMemo(() => {
    const root: TreeNode[] = [];
    const folderMap = new Map<string, TreeNode>();

    // Filter items based on view mode and search
    const filteredItems = items.filter(item => {
      // Search filter
      if (!item.toLowerCase().includes(search.toLowerCase())) return false;

      // View mode filter
      const isRootFile = !item.includes('/');
      if (viewMode === 'files' && !isRootFile) return false;
      // For 'folders' mode, we might want to hide root files?
      // "Toggle between folders and stray files" implies separation.
      // If mode is 'folders', we show the tree. Usually specific to "organized" content.
      // Let's hide root files in 'folders' mode to make it distinct, or keep them?
      // User said "toggle between folders and stray files".
      if (viewMode === 'folders' && isRootFile) return false;

      return true;
    });

    const sortedItems = [...filteredItems].sort((a, b) => {
      const aParts = a.split('/');
      const bParts = b.split('/');
      for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
        if (aParts[i] !== bParts[i]) {
          return aParts[i].localeCompare(bParts[i]);
        }
      }
      return aParts.length - bParts.length;
    });

    sortedItems.forEach(item => {
      const parts = item.split('/');

      if (parts.length === 1) {
        root.push({ name: parts[0], fullPath: item, type: 'file' });
      } else {
        let currentPath = '';
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          const parentPath = currentPath;
          currentPath = currentPath ? `${currentPath}/${part}` : part;

          if (!folderMap.has(currentPath)) {
            const folderNode: TreeNode = { name: part, fullPath: currentPath, type: 'folder', children: [] };
            folderMap.set(currentPath, folderNode);
            if (parentPath) {
              folderMap.get(parentPath)?.children?.push(folderNode);
            } else {
              root.push(folderNode);
            }
          }
        }

        const parentPath = parts.slice(0, -1).join('/');
        const fileNode: TreeNode = { name: parts[parts.length - 1], fullPath: item, type: 'file' };

        if (parentPath) {
          folderMap.get(parentPath)?.children?.push(fileNode);
        } else {
          root.push(fileNode);
        }
      }
    });
    return root;
  }, [items, search, viewMode]);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) next.delete(folderPath);
      else next.add(folderPath);
      return next;
    });
  };

  const renderTreeNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.fullPath);
    const isSelected = node.fullPath === currentItem;
    const paddingLeft = depth * 12 + 8;

    if (node.type === 'folder') {
      return (
        <div key={node.fullPath}>
          <div
            className="flex items-center justify-between hover:bg-gray-600 rounded-md px-2 py-2 group transition-all cursor-pointer"
            style={{ paddingLeft: `${paddingLeft}px` }}
          >
            <div
              className="flex items-center gap-2 flex-1 min-w-0"
              onClick={() => toggleFolder(node.fullPath)}
            >
              {isExpanded ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />}
              <Folder size={14} className="text-yellow-500 flex-shrink-0" />
              <span className="truncate text-sm text-gray-200" title={node.name}>{node.name}</span>
            </div>

            {(isDesktopOpen || window.innerWidth < 768) && (
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {onCreateFileInFolder && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onCreateFileInFolder(node.fullPath); }}
                    className="text-green-500 hover:text-green-400"
                    title="New File in Folder"
                  >
                    <Plus size={14} />
                  </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); onRename(node.fullPath); }} className="text-yellow-500 hover:text-yellow-400"><Pencil size={14} /></button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(node.fullPath); }} className="text-red-500 hover:text-red-400"><Trash2 size={14} /></button>
              </div>
            )}
          </div>
          {isExpanded && node.children && <div>{node.children.map(child => renderTreeNode(child, depth + 1))}</div>}
        </div>
      );
    }

    return (
      <div
        key={node.fullPath}
        className={`flex items-center justify-between hover:bg-gray-600 rounded-md px-2 py-2 group transition-all cursor-pointer ${isSelected ? 'bg-blue-900' : ''}`}
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={() => {
          onSelect(node.fullPath);
          if (window.innerWidth < 768 && onClose) onClose();
        }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <File size={14} className="text-blue-400 flex-shrink-0" />
          <span className={`truncate text-sm ${isSelected ? 'text-blue-300 font-medium' : 'text-gray-200'}`} title={node.name}>{node.name}</span>
        </div>

        {(isDesktopOpen || window.innerWidth < 768) && (
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={(e) => { e.stopPropagation(); onRename(node.fullPath); }} className="text-yellow-500 hover:text-yellow-400"><Pencil size={14} /></button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(node.fullPath); }} className="text-red-500 hover:text-red-400"><Trash2 size={14} /></button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`
        bg-gray-800 flex flex-col border-r border-gray-600 transition-all duration-300 ease-in-out
        ${/* Mobile: Fixed overlay if open, hidden if closed */ ""}
        fixed inset-0 z-50 w-full h-full 
        ${isOpen ? "flex" : "hidden"} 
        
        ${/* Desktop: Relative, static, width controlled by isDesktopOpen */ ""}
        md:relative md:flex md:h-full md:z-0 md:static md:inset-auto
        ${isDesktopOpen ? "md:w-64 md:sm:w-80" : "md:w-16"}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-4 flex-shrink-0 border-b border-gray-700/50 md:border-none">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (window.innerWidth < 768) {
                if (onClose) onClose();
              } else {
                setIsDesktopOpen(!isDesktopOpen);
              }
            }}
            className="text-gray-400 hover:text-white transition"
          >
            {/* Mobile: Back Arrow */}
            <div className="md:hidden">
              <ChevronRight size={24} className="transform rotate-180" />
            </div>
            {/* Desktop: Menu Hamburger */}
            <div className="hidden md:block">
              <Menu size={20} />
            </div>
          </button>
          <span className={`text-lg font-bold text-gray-200 md:hidden`}>
            {currentItem ? currentItem.split('/').pop() : `${typeLabel}s`}
          </span>
          <span className={`text-sm font-semibold text-gray-300 hidden md:inline ${!isDesktopOpen && 'md:hidden'}`}>
            {typeLabel}s
          </span>
        </div>
      </div>

      {/* Content Container */}
      <div className={`flex flex-col flex-1 min-h-0 overflow-hidden ${!isDesktopOpen ? 'md:hidden' : ''}`}>

        {/* Toggle (Folders/Files) */}
        <div className="px-4 pb-2">
          <div className="flex bg-gray-900/50 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('folders')}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'folders' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-gray-300'}`}
            >
              <Folder size={12} />
              <span>Folders</span>
            </button>
            <button
              onClick={() => setViewMode('files')}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'files' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-gray-300'}`}
            >
              <FileText size={12} />
              <span>Stray Files</span>
            </button>
          </div>
        </div>

        <div className="px-4 flex flex-col gap-3 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder={`Search...`}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-600 bg-gray-700 text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            {onCreateFolder && viewMode === 'folders' && (
              <button
                onClick={onCreateFolder}
                className="flex items-center justify-center gap-2 py-2 px-3 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition text-sm font-medium flex-1"
              >
                <FolderPlus size={16} />
                <span className="truncate">Folder</span>
              </button>
            )}
            <button
              onClick={() => onCreate()}
              disabled={isCreating}
              className="flex items-center justify-center gap-2 py-2 px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={16} />
              <span className="truncate">{typeLabel}</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-gray-700 px-2 pb-4">
          {items.length === 0 ? (
            <p className="text-center text-gray-400 text-sm font-medium mt-4">No items.</p>
          ) : treeStructure.length === 0 ? (
            <p className="text-center text-gray-400 text-sm font-medium mt-4">No results.</p>
          ) : (
            <div className="space-y-1">
              {treeStructure.map(node => renderTreeNode(node))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubSidebar;