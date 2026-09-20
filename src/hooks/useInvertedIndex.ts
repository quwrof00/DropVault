import { useMemo } from 'react';

export const useInvertedIndex = (files: Record<string, string>) => {
  return useMemo(() => {
    const index = new Map<string, Set<string>>();

    Object.entries(files).forEach(([id, content]) => {
      // Strip HTML tags for clean text indexing
      const doc = new DOMParser().parseFromString(content, 'text/html');
      const cleanContent = doc.body.textContent || "";
      
      // Include the title/id in the index as well
      const fullText = id + " " + cleanContent;
      // Tokenize by word boundaries, convert to lowercase
      const words = fullText.toLowerCase().split(/[\s\W]+/);
      
      const uniqueWords = new Set(words.filter(w => w.length > 0));

      uniqueWords.forEach(word => {
        if (!index.has(word)) {
          index.set(word, new Set());
        }
        index.get(word)!.add(id);
      });
    });

    return index;
  }, [files]);
};
