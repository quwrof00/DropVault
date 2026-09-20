import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, FileText, ChevronRight } from 'lucide-react';

interface NoteSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: Record<string, string>;
  index: Map<string, Set<string>>;
  onSelectNote: (id: string) => void;
}

export const NoteSearchModal: React.FC<NoteSearchModalProps> = ({
  isOpen,
  onClose,
  files,
  index,
  onSelectNote,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Search logic
  const results = useMemo(() => {
    if (!query.trim()) return [];
    
    const searchTerms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (searchTerms.length === 0) return [];
    
    let matchingNoteIds: Set<string> | null = null;

    for (const term of searchTerms) {
      const termMatches = new Set<string>();
      for (const [word, noteIds] of index.entries()) {
        if (word.includes(term)) {
          noteIds.forEach(id => termMatches.add(id));
        }
      }
      
      if (matchingNoteIds === null) {
        matchingNoteIds = termMatches;
      } else {
        const intersected = new Set<string>();
        matchingNoteIds.forEach(id => {
          if (termMatches.has(id)) intersected.add(id);
        });
        matchingNoteIds = intersected;
      }
      
      if (matchingNoteIds.size === 0) break;
    }
    
    if (!matchingNoteIds) return [];

    // Generate snippets
    const searchResults: { id: string; title: React.ReactNode; snippet: React.ReactNode }[] = [];
    
    matchingNoteIds.forEach(id => {
      const rawContent = files[id];
      if (!rawContent) return;

      const doc = new DOMParser().parseFromString(rawContent, 'text/html');
      const content = doc.body.textContent || "";

      // Parse title from id
      const titleMatchStr = id.indexOf(':');
      const rawTitle = titleMatchStr !== -1 ? id.slice(titleMatchStr + 1) : id;

      const lowerContent = content.toLowerCase();
      const exactQuery = query.toLowerCase().trim();
      let matchIndex = lowerContent.indexOf(exactQuery);
      let matchLength = exactQuery.length;
      let matchedPhrase = exactQuery;
      
      if (matchIndex === -1) {
        // If exact phrase not found, find the first term to base snippet around
        for (const term of searchTerms) {
          matchIndex = lowerContent.indexOf(term);
          if (matchIndex !== -1) {
            matchLength = term.length;
            matchedPhrase = term;
            break;
          }
        }
      }
      
      let snippetNode: React.ReactNode = "";

      if (matchIndex !== -1) {
        const start = Math.max(0, matchIndex - 40);
        const end = Math.min(content.length, matchIndex + matchLength + 40);
        
        let snippetText = content.substring(start, end);
        if (start > 0) snippetText = '...' + snippetText;
        if (end < content.length) snippetText = snippetText + '...';

        const highlightStart = snippetText.toLowerCase().indexOf(matchedPhrase);
        if (highlightStart !== -1) {
          const before = snippetText.substring(0, highlightStart);
          const match = snippetText.substring(highlightStart, highlightStart + matchLength);
          const after = snippetText.substring(highlightStart + matchLength);
          snippetNode = (
            <>
              {before}
              <span className="bg-yellow-500/40 text-yellow-100 font-semibold px-0.5 rounded">{match}</span>
              {after}
            </>
          );
        } else {
          snippetNode = snippetText;
        }
      } else {
        // Matched title, just show beginning of content
        snippetNode = content.substring(0, 80) + (content.length > 80 ? '...' : '');
      }

      let highlightedTitle: React.ReactNode = rawTitle;
      const lowerTitle = rawTitle.toLowerCase();
      
      let titleMatchIndex = lowerTitle.indexOf(exactQuery);
      let titleMatchLength = exactQuery.length;
      
      if (titleMatchIndex === -1) {
        for (const term of searchTerms) {
          titleMatchIndex = lowerTitle.indexOf(term);
          if (titleMatchIndex !== -1) {
            titleMatchLength = term.length;
            break;
          }
        }
      }

      if (titleMatchIndex !== -1) {
        const before = rawTitle.substring(0, titleMatchIndex);
        const match = rawTitle.substring(titleMatchIndex, titleMatchIndex + titleMatchLength);
        const after = rawTitle.substring(titleMatchIndex + titleMatchLength);
        highlightedTitle = (
          <>
            {before}
            <span className="bg-yellow-500/40 text-yellow-100 font-semibold px-0.5 rounded">{match}</span>
            {after}
          </>
        );
      }

      searchResults.push({ id, title: highlightedTitle, snippet: snippetNode });
    });

    return searchResults;
  }, [query, index, files]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Search Input */}
        <div className="flex items-center px-4 py-3 border-b border-gray-800 bg-gray-800/50">
          <Search className="text-blue-400 mr-3" size={20} />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-gray-100 placeholder-gray-500 text-lg"
            placeholder="Search within notes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-700">
            <X size={20} />
          </button>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {!query.trim() ? (
            <div className="text-center py-12 text-gray-500 flex flex-col items-center">
              <FileText size={48} className="mb-4 opacity-20" />
              <p>Type to search through all decrypted notes.</p>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No matches found for "<span className="text-gray-300">{query}</span>"</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => {
                    onSelectNote(result.id);
                    onClose();
                  }}
                  className="flex flex-col text-left w-full p-3 rounded-xl hover:bg-gray-800 transition-colors group focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <div className="flex items-center gap-2 text-gray-200 font-medium">
                      <FileText size={14} className="text-blue-400" />
                      <span className="truncate">{result.title}</span>
                    </div>
                    <ChevronRight size={14} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
                  </div>
                  <div className="text-sm text-gray-400 font-mono bg-gray-950/50 p-2 rounded-lg break-all">
                    {result.snippet}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-800 bg-gray-900/80 text-xs text-gray-500 flex justify-between items-center">
          <span><span className="font-semibold text-gray-400">{results.length}</span> results</span>
          <span className="flex items-center gap-1">Press <kbd className="bg-gray-800 border border-gray-700 rounded px-1 text-[10px]">ESC</kbd> to close</span>
        </div>
      </div>
    </div>
  );
};
