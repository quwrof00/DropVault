import React, { useState, useMemo, useEffect } from "react";
import { Plus, Search, Pencil, Trash2, Folder, File, ChevronRight, ChevronDown, FolderPlus, FileText } from "lucide-react";
import { useIntersectionObserver } from "../../hooks/useIntersectionObserver";

export interface SidebarItem {
  id: string;
  path: string;
  name?: string;
  updated_at?: string;
  created_at?: string;
}

interface SidebarProps {
  search: string;
  setSearch: (value: string) => void;
  items: SidebarItem[];
  onCreate: (path?: string) => void;
  onCreateFolder?: () => void;
  onSelect: (id: string) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  onCreateFileInFolder?: (folderPath: string) => void;
  currentItem: string;
  typeLabel: string;
  isCreating: boolean;
  itemCounts?: { [key: string]: number };
  isItemEditable?: (id: string) => boolean;
  getItemBadge?: (id: string) => { text: string; colorClass: string } | undefined;
  isOpen?: boolean;
  onClose?: () => void;
  onOpenSearch?: () => void;
}

interface TreeNode {
  id: string;
  name: string;
  fullPath: string;
  type: 'file' | 'folder';
  children?: TreeNode[];
  updated_at?: string;
  created_at?: string;
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
  itemCounts = {},
  isItemEditable,
  getItemBadge,
  isOpen = false,
  onClose,
  onOpenSearch
}) => {
  const [isDesktopOpen, setIsDesktopOpen] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'folders' | 'files'>('folders');
  const [visibleCount, setVisibleCount] = useState(50);
  const [sortType, setSortType] = useState<'alphabetical' | 'updated_at' | 'created_at'>('updated_at');
  
  // Focused folder state for drill-down navigation
  const [focusedFolder, setFocusedFolder] = useState<string | null>(null);

  const { targetRef, isIntersecting } = useIntersectionObserver({ rootMargin: '200px' });

  useEffect(() => {
    if (isIntersecting) {
      setVisibleCount(prev => prev + 50);
    }
  }, [isIntersecting]);

  useEffect(() => {
    setVisibleCount(50);
  }, [search, viewMode, sortType]);

  // Keyboard shortcut for creating a new item
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onCreate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCreate]);

  // Build tree structure
  const { treeStructure, totalCount } = useMemo(() => {
    const root: TreeNode[] = [];
    const folderMap = new Map<string, TreeNode>();

    const filteredItems = items.filter(item => {
      if (!item.path.toLowerCase().includes(search.toLowerCase())) return false;
      const isRootFile = !item.path.includes('/');
      if (viewMode === 'files' && !isRootFile) return false;
      if (viewMode === 'folders' && isRootFile) return false;
      return true;
    });

    filteredItems.forEach(itemObj => {
      const parts = itemObj.path.split('/');
      if (parts.length === 1) {
        root.push({ id: itemObj.id, name: parts[0], fullPath: itemObj.path, type: 'file', updated_at: itemObj.updated_at, created_at: itemObj.created_at });
      } else {
        let currentPath = '';
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          const parentPath = currentPath;
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          if (!folderMap.has(currentPath)) {
            const folderNode: TreeNode = { id: currentPath, name: part, fullPath: currentPath, type: 'folder', children: [] };
            folderMap.set(currentPath, folderNode);
            if (parentPath) {
              folderMap.get(parentPath)?.children?.push(folderNode);
            } else {
              root.push(folderNode);
            }
          }
        }
        const parentPath = parts.slice(0, -1).join('/');
        const fileNode: TreeNode = { id: itemObj.id, name: parts[parts.length - 1], fullPath: itemObj.path, type: 'file', updated_at: itemObj.updated_at, created_at: itemObj.created_at };
        if (parentPath) {
          folderMap.get(parentPath)?.children?.push(fileNode);
        } else {
          root.push(fileNode);
        }
      }
    });

    const computeDatesAndSort = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        if (node.type === 'folder' && node.children) {
          computeDatesAndSort(node.children);
          let maxUpdated = 0;
          let maxCreated = 0;
          let hasUpdated = false;
          let hasCreated = false;
          node.children.forEach(child => {
             if (child.updated_at) {
                const d = new Date(child.updated_at).getTime();
                if (d > maxUpdated) maxUpdated = d;
                hasUpdated = true;
             }
             if (child.created_at) {
                const d = new Date(child.created_at).getTime();
                if (d > maxCreated) maxCreated = d;
                hasCreated = true;
             }
          });
          if (hasUpdated) node.updated_at = new Date(maxUpdated).toISOString();
          if (hasCreated) node.created_at = new Date(maxCreated).toISOString();
        }
      });

      nodes.sort((a, b) => {
         if (sortType !== 'alphabetical') {
            const aDate = sortType === 'updated_at' ? a.updated_at : a.created_at;
            const bDate = sortType === 'updated_at' ? b.updated_at : b.created_at;
            if (aDate && bDate) {
              const diff = new Date(bDate).getTime() - new Date(aDate).getTime();
              if (diff !== 0) return diff;
            } else if (aDate) {
              return -1;
            } else if (bDate) {
              return 1;
            }
         }
         return a.name.localeCompare(b.name);
      });
    };

    computeDatesAndSort(root);

    let treeToRender = root;
    if (focusedFolder && folderMap.has(focusedFolder)) {
      treeToRender = folderMap.get(focusedFolder)?.children || [];
    }

    const finalTree = treeToRender.slice(0, visibleCount);
    return { treeStructure: finalTree, totalCount: treeToRender.length };
  }, [items, search, viewMode, visibleCount, sortType, focusedFolder]);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) next.delete(folderPath);
      else next.add(folderPath);
      return next;
    });
  };

  const goBack = () => {
    if (!focusedFolder) return;
    const parts = focusedFolder.split('/');
    if (parts.length > 1) {
      setFocusedFolder(parts.slice(0, -1).join('/'));
    } else {
      setFocusedFolder(null);
    }
  };

  const goHome = () => setFocusedFolder(null);

  React.useEffect(() => {
    if (!currentItem) return;
    if (currentItem.includes('/')) {
      const parts = currentItem.split('/');
      if (parts.length > 1) {
        setViewMode('folders');
        setExpandedFolders(prev => {
          const next = new Set(prev);
          let cumulativePath = '';
          for (let i = 0; i < parts.length - 1; i++) {
            cumulativePath = cumulativePath ? `${cumulativePath}/${parts[i]}` : parts[i];
            next.add(cumulativePath);
          }
          return next;
        });
      }
    }
  }, [currentItem, items]);

  const renderTreeNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.fullPath);
    const isSelected = node.id === currentItem;
    const containsCurrentItem = currentItem && currentItem.startsWith(node.fullPath + '/');
    const paddingLeft = depth * 14 + 12;
    const count = itemCounts[node.fullPath] || 0;

    const indentLines = [];
    for (let i = 1; i <= depth; i++) {
       indentLines.push(
         <div key={i} className="absolute top-0 bottom-0 border-l border-gray-700/40" style={{ left: `${i * 14 + 4}px` }} />
       );
    }

    if (node.type === 'folder') {
      return (
        <div key={node.id} className="relative">
          {indentLines}
          <div
            className={`flex items-center justify-between rounded-md px-2 py-1.5 group ${containsCurrentItem && !isExpanded ? 'bg-blue-600/15 shadow-[inset_3px_0_0_0_rgb(59,130,246)]' : 'hover:bg-gray-700/40'}`}
            style={{ paddingLeft: `${paddingLeft}px` }}
          >
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <button 
                onClick={(e) => { e.stopPropagation(); toggleFolder(node.fullPath); }} 
                className="p-0.5 hover:bg-gray-600 rounded text-gray-500 hover:text-gray-300"
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              <div 
                onClick={(e) => { e.stopPropagation(); setFocusedFolder(node.fullPath); }} 
                className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer pl-1"
                title={`Focus into ${node.name}`}
              >
                <Folder size={14} className="text-blue-400/80 group-hover:text-blue-400 flex-shrink-0" />
                <span className="truncate text-sm font-medium text-gray-300 group-hover:text-white">{node.name}</span>
              </div>
            </div>

            {(isDesktopOpen || window.innerWidth < 768) && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                {onCreateFileInFolder && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onCreateFileInFolder(node.fullPath); }}
                    className="text-gray-400 hover:text-green-400 p-1"
                    title="New File in Folder"
                  >
                    <Plus size={14} />
                  </button>
                )}
                {(!isItemEditable || isItemEditable(node.id)) && (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); onRename(node.id); }} className="text-gray-400 hover:text-yellow-400 p-1"><Pencil size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} className="text-gray-400 hover:text-red-400 p-1"><Trash2 size={14} /></button>
                  </>
                )}
              </div>
            )}
          </div>
          {isExpanded && node.children && <div className="mt-0.5">{node.children.map(child => renderTreeNode(child, depth + 1))}</div>}
        </div>
      );
    }

    const displayDate = sortType === 'updated_at' ? node.updated_at : node.created_at;
    const formattedDate = displayDate ? new Date(displayDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';

    return (
      <div key={node.id} className="relative">
        {indentLines}
        <div
          className={`flex items-center justify-between rounded-md px-2 py-2 group cursor-pointer ${isSelected ? 'bg-blue-600/15 shadow-[inset_3px_0_0_0_rgb(59,130,246)]' : 'hover:bg-gray-700/30'}`}
          style={{ paddingLeft: `${paddingLeft}px` }}
          onClick={() => {
            onSelect(node.id);
            if (window.innerWidth < 768 && onClose) onClose();
          }}
        >
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <File size={14} className={`${isSelected ? 'text-blue-400' : 'text-gray-500 group-hover:text-blue-400'} flex-shrink-0`} />
              <span className={`truncate text-sm ${isSelected ? 'text-white font-semibold' : 'text-gray-300 group-hover:text-white'}`} title={node.name}>{node.name}</span>
              {count > 0 && (
                <span className="ml-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-500/90 text-[10px] text-white font-bold ring-1 ring-gray-900/50">
                  {count > 99 ? '99+' : count}
                </span>
              )}
              {getItemBadge && getItemBadge(node.id) && (
                <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium shadow-sm ${getItemBadge(node.id)!.colorClass}`}>
                  {getItemBadge(node.id)!.text}
                </span>
              )}
            </div>
            {sortType !== 'alphabetical' && formattedDate && (
              <span className={`text-[10px] pl-6 pt-0.5 ${isSelected ? 'text-gray-400' : 'text-gray-500 group-hover:text-gray-400'}`}>{formattedDate}</span>
            )}
          </div>

          {(isDesktopOpen || window.innerWidth < 768) && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100">
              {(!isItemEditable || isItemEditable(node.id)) && (
                <>
                  <button onClick={(e) => { e.stopPropagation(); onRename(node.id); }} className="text-gray-400 hover:text-yellow-400 p-1"><Pencil size={14} /></button>
                  <button onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} className="text-gray-400 hover:text-red-400 p-1"><Trash2 size={14} /></button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`
      bg-gray-800/95 backdrop-blur-md flex flex-col border-r border-gray-700 shadow-xl
      ${/* Mobile: Fixed overlay if open, hidden if closed */ ""}
      fixed inset-0 z-50 w-full h-full 
      ${isOpen ? "flex" : "hidden"} 
      
      ${/* Desktop: Relative, static, width controlled by isDesktopOpen */ ""}
      md:relative md:flex md:h-full md:z-0 md:static md:inset-auto
      ${isDesktopOpen ? "md:w-72" : "md:w-16"}
    `}
    >
      {/* Header */}
      <div className={`flex items-center px-4 py-3 flex-shrink-0 border-b border-gray-700/50 ${!isDesktopOpen ? 'justify-center' : 'justify-between'}`}>
        <div className={`flex items-center gap-2 ${!isDesktopOpen ? 'md:hidden' : ''}`}>
          {/* Mobile: Back Arrow */}
          <button
            onClick={() => {
              if (window.innerWidth < 768 && onClose) onClose();
            }}
            className="text-gray-400 hover:text-white md:hidden"
          >
            <ChevronRight size={20} className="rotate-180" />
          </button>
          
          <span className={`text-base font-bold text-gray-200 md:hidden tracking-tight`}>
            {currentItem ? currentItem.split('/').pop() : `${typeLabel}s`}
          </span>
          <span className={`text-xs font-semibold text-gray-400 hidden md:inline tracking-wider uppercase`}>
            {typeLabel}s
          </span>
        </div>

        <div className={`flex items-center gap-1 ${!isDesktopOpen ? 'hidden' : ''}`}>
          {onCreateFolder && viewMode === 'folders' && (
            <button
              onClick={onCreateFolder}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-md transition-colors"
              title={`New Folder`}
            >
              <FolderPlus size={16} />
            </button>
          )}
          <button
            onClick={() => onCreate()}
            disabled={isCreating}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-md transition-colors disabled:opacity-50"
            title={`New ${typeLabel} (C)`}
          >
            <Plus size={16} />
          </button>
          {/* Desktop Toggle */}
          <button
            onClick={() => setIsDesktopOpen(!isDesktopOpen)}
            className="p-1.5 ml-1 text-gray-500 hover:text-white hover:bg-gray-700/70 rounded-md transition-colors"
            title="Collapse Sidebar"
          >
            <ChevronDown className="rotate-90" size={16} />
          </button>
        </div>

        {/* Desktop Toggle when collapsed */}
        {!isDesktopOpen && (
          <button
            onClick={() => setIsDesktopOpen(!isDesktopOpen)}
            className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700/70 rounded-md transition-colors absolute top-3 left-1/2 -translate-x-1/2"
            title="Expand Sidebar"
          >
            <ChevronDown className="-rotate-90" size={16} />
          </button>
        )}
      </div>

      {/* Content Container */}
      <div className={`flex flex-col flex-1 min-h-0 overflow-hidden ${!isDesktopOpen ? 'md:hidden' : ''}`}>

        {/* Controls: Search, Sort, Tabs */}
        <div className="px-3 py-2 flex flex-col gap-2 border-b border-gray-700/30">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1 group">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 group-hover:text-gray-400" size={14} />
              {onOpenSearch ? (
                <button
                  onClick={onOpenSearch}
                  className="w-full text-left pl-8 pr-2 py-1.5 rounded-md border border-gray-700/50 bg-gray-900/30 text-gray-400 hover:bg-gray-700/50 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs shadow-inner"
                >
                  Search...
                </button>
              ) : (
                <input
                  type="text"
                  placeholder={`Search...`}
                  className="w-full pl-8 pr-2 py-1.5 rounded-md border border-gray-700/50 bg-gray-900/30 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs shadow-inner focus:bg-gray-800"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              )}
            </div>
            <select
              className="bg-gray-900/30 border border-gray-700/50 text-gray-300 text-xs rounded-md py-1.5 px-1 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[80px] shadow-inner font-medium hover:bg-gray-800 cursor-pointer"
              value={sortType}
              onChange={(e) => setSortType(e.target.value as any)}
              title="Sort by"
            >
              <option value="updated_at">Updated</option>
              <option value="created_at">Created</option>
              <option value="alphabetical">A-Z</option>
            </select>
          </div>

          <div className="flex bg-gray-900/60 p-0.5 rounded-md border border-gray-700/50 shadow-inner">
            <button
              onClick={() => setViewMode('folders')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded-sm text-xs font-semibold ${viewMode === 'folders' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <Folder size={12} />
              <span>Folders</span>
            </button>
            <button
              onClick={() => setViewMode('files')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded-sm text-xs font-semibold ${viewMode === 'files' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <FileText size={12} />
              <span>Stray</span>
            </button>
          </div>
        </div>

        {focusedFolder && (
          <div className="px-3 py-2 border-b border-gray-700/30 flex items-center gap-1 bg-gray-900/40 text-gray-400 text-sm shadow-inner">
             <button onClick={goHome} className="p-1 hover:text-white hover:bg-gray-700/50 rounded" title="Home">
                <Folder size={14} />
             </button>
             <ChevronRight size={14} className="opacity-50" />
             <button onClick={goBack} className="p-1 hover:text-white hover:bg-gray-700/50 rounded flex items-center gap-1 min-w-0 flex-1" title="Go Back">
                <span className="truncate font-semibold text-gray-300">{focusedFolder.split('/').pop()}</span>
             </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent px-2 py-2">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
              <FileText size={32} className="opacity-20" />
              <p className="text-sm font-medium">No items found.</p>
            </div>
          ) : treeStructure.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
              <Search size={32} className="opacity-20" />
              <p className="text-sm font-medium">No matching results.</p>
            </div>
          ) : (
            <div className="space-y-0.5 relative">
              {treeStructure.map(node => renderTreeNode(node))}
            </div>
          )}
          {totalCount > visibleCount && (
            <div ref={targetRef} className="h-10 w-full flex items-center justify-center mt-4">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubSidebar;