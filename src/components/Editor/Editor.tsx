// components/Editor.tsx
import { useState } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import './editor.css';

interface EditorProps {
  content: string;
  onUpdate: (updatedContent: string) => void;
  isFullScreen?: boolean;
  readOnly?: boolean;
}

interface CopyProps {
  copied: boolean;
}

const ClipboardIcon = ({ copied }: CopyProps) => (
  <svg
    className={`w-5 h-5`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    {copied ? (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    ) : (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
      />
    )}
  </svg>
);

const modules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    ['clean']
  ],
};

export default function Editor({ content, onUpdate, isFullScreen, readOnly }: EditorProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;
      const text = tempDiv.textContent || tempDiv.innerText || '';
      
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  return (
    <div className="editor-wrapper flex flex-col h-full quill-dark-theme relative w-full">
      <div className={`absolute top-2 z-[60] transition-all ${isFullScreen ? 'right-14' : 'right-2'}`}>
         <button
           onClick={handleCopy}
           className={`flex items-center gap-1.5 p-1.5 px-3 rounded-md text-sm font-medium ${copied
             ? 'bg-green-500/20 text-green-400 border border-green-500/20'
             : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200 bg-gray-800/80 backdrop-blur-sm'
           }`}
           aria-label="Copy to clipboard"
         >
           <ClipboardIcon copied={copied} />
           {copied ? 'Copied' : 'Copy'}
         </button>
      </div>

      <ReactQuill 
        theme="snow"
        value={content}
        onChange={readOnly ? undefined : onUpdate}
        readOnly={readOnly}
        modules={readOnly ? { toolbar: false } : modules}
        className="h-full flex flex-col flex-1 text-gray-100"
      />
    </div>
  );
}
