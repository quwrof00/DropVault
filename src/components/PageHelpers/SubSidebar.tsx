import React, { useState } from "react";
import { Menu, Plus, Search, Pencil, Trash2 } from "lucide-react"; // optional: use any icons

interface SidebarProps {
  search: string;
  setSearch: (value: string) => void;
  items: string[];
  onCreate: () => void;
  onSelect: (name: string) => void;
  onRename: (name: string) => void;
  onDelete: (name: string) => void;
  currentItem: string;
  typeLabel: string; // e.g., "Note", "Snippet"
  isCreating: boolean
}

const SubSidebar: React.FC<SidebarProps> = ({
  search,
  setSearch,
  items,
  onCreate,
  onSelect,
  onRename,
  onDelete,
  currentItem,
  typeLabel,
}) => {
  const [isOpen, setIsOpen] = useState(true);

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
          <button
            onClick={onCreate}
            className="flex items-center gap-2 py-2 px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
          >
            <Plus size={16} />
            <span className="truncate">New {typeLabel}</span>
          </button>
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
        ) : (
          <div className="space-y-1">
            {items.map((name) => (
              <div
                key={name}
                className="flex items-center justify-between hover:bg-gray-600 rounded-md px-2 py-2 group transition-all"
              >
                <span
                  onClick={() => onSelect(name)}
                  className={`truncate text-sm cursor-pointer text-gray-200 ${
                    name === currentItem
                      ? "bg-blue-900 text-blue-300 px-2 py-1 rounded-md"
                      : ""
                  }`}
                  title={name}
                >
                  {isOpen ? name : name.slice(0, 1).toUpperCase()}
                </span>
                {isOpen && (
                  <div className="flex gap-2 opacity-80 group-hover:opacity-100">
                    <button
                      onClick={() => onRename(name)}
                      className="text-yellow-500 hover:text-yellow-400"
                      title="Rename"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => onDelete(name)}
                      className="text-red-500 hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SubSidebar;
