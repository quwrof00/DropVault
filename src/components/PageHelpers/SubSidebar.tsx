import React, { useState, useMemo } from "react";
import { Menu, Plus, Search, Pencil, Trash2, Folder, File, ChevronRight, ChevronDown, FolderPlus } from "lucide-react";

interface SidebarProps {
  search: string;
  setSearch: (value: string) => void;
  items: string[]; // Can include paths like "Work/Notes" or just "Notes"
  onCreate: () => void;
  onCreateFolder?: () => void; // Optional folder creation
  onSelect: (name: string) => void;
  onRename: (name: string) => void;
  onDelete: (name: string) => void;
  currentItem: string;
  typeLabel: string;
  isCreating: boolean;
  currentFolder?: string; // Track current folder context
  onFolderChange?: (folder: string) => void; // Navigate into folder
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
  currentItem,
  typeLabel,
  isCreating,
  currentFolder = "",
  onFolderChange,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Build tree structure from flat list of paths
  const treeStructure = useMemo(() => {
    const root: TreeNode[] = [];
    const folderMap = new Map<string, TreeNode>();

    // Filter items by search
    const filteredItems = items.filter(item => 
      item.toLowerCase().includes(search.toLowerCase())
    );

    // Sort items to ensure folders come before files
    const sortedItems = [...filteredItems].sort((a, b) => {
      const aParts = a.split('/');
      const bParts = b.split('/');
      
      // Compare each level
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
        // Root level file
        root.push({
          name: parts[0],
          fullPath: item,
          type: 'file'
        });
      } else {
        // Nested file - create folder structure
        let currentPath = '';
        
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          const parentPath = currentPath;
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          
          if (!folderMap.has(currentPath)) {
            const folderNode: TreeNode = {
              name: part,
              fullPath: currentPath,
              type: 'folder',
              children: []
            };
            
            folderMap.set(currentPath, folderNode);
            
            if (parentPath) {
              const parent = folderMap.get(parentPath);
              parent?.children?.push(folderNode);
            } else {
              root.push(folderNode);
            }
          }
        }
        
        // Add the file to its parent folder
        const parentPath = parts.slice(0, -1).join('/');
        const fileNode: TreeNode = {
          name: parts[parts.length - 1],
          fullPath: item,
          type: 'file'
        };
        
        if (parentPath) {
          const parent = folderMap.get(parentPath);
          parent?.children?.push(fileNode);
        } else {
          root.push(fileNode);
        }
      }
    });

    return root;
  }, [items, search]);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
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
              {isExpanded ? (
                <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
              )}
              <Folder size={14} className="text-yellow-500 flex-shrink-0" />
              <span className="truncate text-sm text-gray-200" title={node.name}>
                {node.name}
              </span>
            </div>
            
            {isOpen && (
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRename(node.fullPath);
                  }}
                  className="text-yellow-500 hover:text-yellow-400"
                  title="Rename folder"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(node.fullPath);
                  }}
                  className="text-red-500 hover:text-red-400"
                  title="Delete folder"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
          
          {isExpanded && node.children && (
            <div>
              {node.children.map(child => renderTreeNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    // File node
    return (
      <div
        key={node.fullPath}
        className={`flex items-center justify-between hover:bg-gray-600 rounded-md px-2 py-2 group transition-all cursor-pointer ${
          isSelected ? 'bg-blue-900' : ''
        }`}
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={() => onSelect(node.fullPath)}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <File size={14} className="text-blue-400 flex-shrink-0" />
          <span
            className={`truncate text-sm ${
              isSelected ? 'text-blue-300 font-medium' : 'text-gray-200'
            }`}
            title={node.name}
          >
            {node.name}
          </span>
        </div>
        
        {isOpen && (
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRename(node.fullPath);
              }}
              className="text-yellow-500 hover:text-yellow-400"
              title="Rename"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(node.fullPath);
              }}
              className="text-red-500 hover:text-red-400"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`h-full transition-all duration-300 ease-in-out border-r border-gray-600 bg-gray-800 flex flex-col ${
        isOpen ? "w-64 sm:w-80" : "w-16"
      }`}
    >
      {/* Toggle Button */}
      <div className="flex items-center justify-between px-3 py-4">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-gray-400 hover:text-white transition"
        >
          <Menu size={20} />
        </button>
        {isOpen && (
          <span className="text-sm font-semibold text-gray-300">
            {typeLabel}s
          </span>
        )}
      </div>

      {/* Search & Create */}
      {isOpen && (
        <div className="px-4 flex flex-col gap-3 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder={`Search ${typeLabel.toLowerCase()}s...`}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-600 bg-gray-700 text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            {onCreateFolder && (
              <button
                onClick={onCreateFolder}
                className="flex items-center justify-center gap-2 py-2 px-3 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition text-sm font-medium flex-1"
                title="New Folder"
              >
                <FolderPlus size={16} />
                <span className="truncate">Folder</span>
              </button>
            )}
            <button
              onClick={onCreate}
              disabled={isCreating}
              className="flex items-center justify-center gap-2 py-2 px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={16} />
              <span className="truncate">{typeLabel}</span>
            </button>
          </div>

          {/* Breadcrumb */}
          {currentFolder && onFolderChange && (
            <div className="flex items-center gap-1 text-xs text-gray-400 overflow-x-auto">
              <button
                onClick={() => onFolderChange("")}
                className="hover:text-blue-400 transition whitespace-nowrap"
              >
                Home
              </button>
              {currentFolder.split('/').map((part, index, arr) => {
                const path = arr.slice(0, index + 1).join('/');
                return (
                  <React.Fragment key={path}>
                    <ChevronRight size={12} />
                    <button
                      onClick={() => onFolderChange(path)}
                      className="hover:text-blue-400 transition whitespace-nowrap"
                    >
                      {part}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-gray-700 px-2">
        {items.length === 0 ? (
          isOpen && (
            <p className="text-center text-gray-400 text-sm font-medium mt-4">
              No {typeLabel.toLowerCase()}s found. Create one!
            </p>
          )
        ) : treeStructure.length === 0 ? (
          isOpen && search && (
            <p className="text-center text-gray-400 text-sm font-medium mt-4">
              No results found for "{search}"
            </p>
          )
        ) : (
          <div className="space-y-1">
            {treeStructure.map(node => renderTreeNode(node))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SubSidebar;