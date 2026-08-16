import React, { useState, useMemo, useEffect } from "react";
import { Plus, Search, Pencil, Trash2, Folder, File, ChevronRight, ChevronDown, FolderPlus, FileText } from "lucide-react";
import { useIntersectionObserver } from "../../hooks/useIntersectionObserver";

export interface SidebarItem {
  id: string;
  path: string;
  name?: string;
}

interface SidebarProps {
 search: string;
 setSearch: (value: string) => void;
 items: SidebarItem[];
 onCreate: (path?: string) => void; // Updated to accept optional path
 onCreateFolder?: () => void;
 onSelect: (id: string) => void;
 onRename: (id: string) => void;
 onDelete: (id: string) => void;
 onCreateFileInFolder?: (folderPath: string) => void;
 currentItem: string; // id
 typeLabel: string;
 isCreating: boolean;
 itemCounts?: { [key: string]: number }; // Optional counts
  isItemEditable?: (id: string) => boolean; // Determines if edit/delete is allowed
  getItemBadge?: (id: string) => { text: string; colorClass: string } | undefined;
  isOpen?: boolean; // Controlled by parent on mobile
  onClose?: () => void; // To close the sidebar
}

interface TreeNode {
  id: string;
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
  itemCounts = {}, // Default empty
  isItemEditable,
  getItemBadge,
  isOpen = false, // Default closed on mobile if not specified
  onClose
}) => {
  const [isDesktopOpen, setIsDesktopOpen] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'folders' | 'files'>('folders'); //'folders' (Tree) | 'files' (Stray/Root only)
  const [visibleCount, setVisibleCount] = useState(50);

  const { targetRef, isIntersecting } = useIntersectionObserver({ rootMargin: '200px' });

  useEffect(() => {
    if (isIntersecting) {
      setVisibleCount(prev => prev + 50);
    }
  }, [isIntersecting]);

 useEffect(() => {
   setVisibleCount(50);
 }, [search, viewMode]);

 // Build tree structure
 const { treeStructure, totalCount } = useMemo(() => {
 const root: TreeNode[] = [];
 const folderMap = new Map<string, TreeNode>();

 // Filter items based on view mode and search
 const filteredItems = items.filter(item => {
 // Search filter
 if (!item.path.toLowerCase().includes(search.toLowerCase())) return false;

 // View mode filter
 const isRootFile = !item.path.includes('/');
 if (viewMode ==='files' && !isRootFile) return false;
 // For'folders' mode, we might want to hide root files?
 //"Toggle between folders and stray files" implies separation.
 // If mode is'folders', we show the tree. Usually specific to"organized" content.
 // Let's hide root files in'folders' mode to make it distinct, or keep them?
 // User said"toggle between folders and stray files".
 if (viewMode ==='folders' && isRootFile) return false;

 return true;
 });

 const sortedItems = [...filteredItems].sort((a, b) => {
 const aParts = a.path.split('/');
 const bParts = b.path.split('/');
 for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
 if (aParts[i] !== bParts[i]) {
 return aParts[i].localeCompare(bParts[i]);
 }
 }
 return aParts.length - bParts.length;
 });

 const itemsToRender = sortedItems.slice(0, visibleCount);

 itemsToRender.forEach(itemObj => {
 const parts = itemObj.path.split('/');

 if (parts.length === 1) {
 root.push({ id: itemObj.id, name: parts[0], fullPath: itemObj.path, type:'file' });
 } else {
 let currentPath ='';
 for (let i = 0; i < parts.length - 1; i++) {
 const part = parts[i];
 const parentPath = currentPath;
 currentPath = currentPath ?`${currentPath}/${part}` : part;

 if (!folderMap.has(currentPath)) {
 const folderNode: TreeNode = { id: currentPath, name: part, fullPath: currentPath, type:'folder', children: [] };
 folderMap.set(currentPath, folderNode);
 if (parentPath) {
 folderMap.get(parentPath)?.children?.push(folderNode);
 } else {
 root.push(folderNode);
 }
 }
 }

 const parentPath = parts.slice(0, -1).join('/');
 const fileNode: TreeNode = { id: itemObj.id, name: parts[parts.length - 1], fullPath: itemObj.path, type:'file' };

 if (parentPath) {
 folderMap.get(parentPath)?.children?.push(fileNode);
 } else {
 root.push(fileNode);
 }
 }
 });
 return { treeStructure: root, totalCount: sortedItems.length };
 }, [items, search, viewMode, visibleCount]);

 const toggleFolder = (folderPath: string) => {
 setExpandedFolders(prev => {
 const next = new Set(prev);
 if (next.has(folderPath)) next.delete(folderPath);
 else next.add(folderPath);
 return next;
 });
 };

 // Auto-expand folders when currentItem changes
 React.useEffect(() => {
 if (!currentItem) return;

 if (currentItem.includes('/')) {
 const parts = currentItem.split('/');
 if (parts.length > 1) {
 setViewMode('folders');
 setExpandedFolders(prev => {
 const next = new Set(prev);
 let cumulativePath ='';
 for (let i = 0; i < parts.length - 1; i++) {
 cumulativePath = cumulativePath ?`${cumulativePath}/${parts[i]}` : parts[i];
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
 const paddingLeft = depth * 12 + 8;
 const count = itemCounts[node.fullPath] || 0;

 // ... (folder rendering) ...

 if (node.type ==='folder') {
 return (
 <div key={node.id}>
 <div
 className="flex items-center justify-between rounded-lg px-2 py-2 group cursor-pointer hover:bg-gray-700/50 transition-colors duration-200"
 style={{ paddingLeft:`${paddingLeft}px` }}
 >
 <div
 className="flex items-center gap-2 flex-1 min-w-0"
 onClick={() => toggleFolder(node.fullPath)}
 >
 {isExpanded ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />}
 <Folder size={14} className="text-yellow-500 flex-shrink-0" />
 <span className="truncate text-sm text-gray-300 group-hover:text-gray-100 transition-colors duration-200" title={node.name}>{node.name}</span>
 </div>

 {(isDesktopOpen || window.innerWidth < 768) && (
 <div className="flex gap-2 opacity-0 group-hover:opacity-100">
 {onCreateFileInFolder && (
 <button
 onClick={(e) => { e.stopPropagation(); onCreateFileInFolder(node.fullPath); }}
 className="text-green-500 hover:text-green-400"
 title="New File in Folder"
 >
 <Plus size={14} />
 </button>
 )}
 {(!isItemEditable || isItemEditable(node.id)) && (
   <>
     <button onClick={(e) => { e.stopPropagation(); onRename(node.id); }} className="text-yellow-500 hover:text-yellow-400"><Pencil size={14} /></button>
     <button onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} className="text-red-500 hover:text-red-400"><Trash2 size={14} /></button>
   </>
 )}
 </div>
 )}
 </div>
 {isExpanded && node.children && <div>{node.children.map(child => renderTreeNode(child, depth + 1))}</div>}
 </div>
 );
 }

 return (
 <div
 key={node.id}
 className={`flex items-center justify-between rounded-lg px-2 py-2 group cursor-pointer transition-colors duration-200 ${isSelected ? 'bg-blue-600/20 shadow-[inset_2px_0_0_0_rgb(59,130,246)]' : 'hover:bg-gray-700/50'}`}
 style={{ paddingLeft:`${paddingLeft}px` }}
 onClick={() => {
 onSelect(node.id);
 if (window.innerWidth < 768 && onClose) onClose();
 }}
 >
 <div className="flex items-center gap-2 flex-1 min-w-0">
 <File size={14} className="text-blue-400 flex-shrink-0" />
 <span className={`truncate text-sm transition-colors duration-200 ${isSelected ? 'text-blue-400 font-semibold' : 'text-gray-300 group-hover:text-gray-100'}`} title={node.name}>{node.name}</span>
 {count > 0 && (
 <span className="ml-2 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold ring-1 ring-gray-900">
 {count > 99 ?'99+' : count}
 </span>
 )}
 
  {getItemBadge && getItemBadge(node.id) && (
    <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${getItemBadge(node.id)!.colorClass}`}>
      {getItemBadge(node.id)!.text}
    </span>
  )}
</div>

 {(isDesktopOpen || window.innerWidth < 768) && (
 <div className="flex gap-2 opacity-0 group-hover:opacity-100">
 {(!isItemEditable || isItemEditable(node.id)) && (
    <>
      <button onClick={(e) => { e.stopPropagation(); onRename(node.id); }} className="text-yellow-500 hover:text-yellow-400"><Pencil size={14} /></button>
      <button onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} className="text-red-500 hover:text-red-400"><Trash2 size={14} /></button>
    </>
  )}
 </div>
 )}
 </div>
 );
 };

 return (
 <div
 className={`
 bg-gray-800 flex flex-col border-r border-gray-600
 ${/* Mobile: Fixed overlay if open, hidden if closed */""}
 fixed inset-0 z-50 w-full h-full 
 ${isOpen ?"flex" :"hidden"} 
 
 ${/* Desktop: Relative, static, width controlled by isDesktopOpen */""}
 md:relative md:flex md:h-full md:z-0 md:static md:inset-auto
 ${isDesktopOpen ?"md:w-64 md:sm:w-80" :"md:w-16"}
`}
 >
 {/* Header */}
 <div className={`flex items-center px-3 py-4 flex-shrink-0 border-b border-gray-700/50 md:border-none ${!isDesktopOpen ?'justify-center' :'justify-between'}`}>
 <div className={`flex items-center gap-3 ${!isDesktopOpen ?'md:hidden' :''}`}>
 {/* Mobile: Back Arrow */}
 <button
 onClick={() => {
 if (window.innerWidth < 768 && onClose) onClose();
 }}
 className="text-gray-400 hover:text-white md:hidden"
 >
 <ChevronRight size={24} className="rotate-180" />
 </button>
 
 <span className={`text-lg font-bold text-gray-200 md:hidden`}>
 {currentItem ? currentItem.split('/').pop() :`${typeLabel}s`}
 </span>
 <span className={`text-sm font-semibold text-gray-300 hidden md:inline`}>
 {typeLabel}s
 </span>
 </div>

 {/* Desktop Toggle */}
 <button
 onClick={() => setIsDesktopOpen(!isDesktopOpen)}
 className={`hidden md:flex text-gray-500 hover:text-white p-1 rounded hover:bg-gray-700 ${!isDesktopOpen ?'absolute top-6 left-1/2 -translate-x-1/2' :''}`}
 title={isDesktopOpen ?"Collapse Sidebar" :"Expand Sidebar"}
 >
 {!isDesktopOpen ? <ChevronDown className="-rotate-90" size={20} /> : <ChevronDown className="rotate-90" size={20} />}
 </button>
 </div>

 {/* Content Container */}
 <div className={`flex flex-col flex-1 min-h-0 overflow-hidden ${!isDesktopOpen ?'md:hidden' :''}`}>

 {/* Toggle (Folders/Files) */}
 <div className="px-4 pb-2">
 <div className="flex bg-gray-900/50 p-1 rounded-lg">
 <button
 onClick={() => setViewMode('folders')}
 className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-medium ${viewMode ==='folders' ?'bg-gray-700 text-white shadow-sm' :'text-gray-400 hover:text-gray-300'}`}
 >
 <Folder size={12} />
 <span>Folders</span>
 </button>
 <button
 onClick={() => setViewMode('files')}
 className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-medium ${viewMode ==='files' ?'bg-gray-700 text-white shadow-sm' :'text-gray-400 hover:text-gray-300'}`}
 >
 <FileText size={12} />
 <span>Stray Files</span>
 </button>
 </div>
 </div>

 <div className="px-4 flex flex-col gap-3 py-2">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
 <input
 type="text"
 placeholder={`Search...`}
 className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-600 bg-gray-700 text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 />
 </div>

 <div className="flex gap-2">
 {onCreateFolder && viewMode ==='folders' && (
 <button
 onClick={onCreateFolder}
 className="flex items-center justify-center gap-2 py-2 px-3 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 text-sm font-medium flex-1"
 >
 <FolderPlus size={16} />
 <span className="truncate">Folder</span>
 </button>
 )}
 <button
 onClick={() => onCreate()}
 disabled={isCreating}
 className="flex items-center justify-center gap-2 py-2 px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
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
 {totalCount > visibleCount && (
   <div ref={targetRef} className="h-10 w-full flex items-center justify-center mt-4">
     <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
   </div>
 )}
 </div>
 </div>
 </div>
 );
};

export default SubSidebar;