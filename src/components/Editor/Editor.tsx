// components/Editor.js
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import './editor.css';
import { useState } from 'react';

interface EditorProps {
  content: string;
  onUpdate: (updatedContent: string) => void;
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

export default function Editor({ content, onUpdate }: EditorProps) {
  const [copied, setCopied] = useState(false);
  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: content || '',
    onUpdate: ({ editor }) => {
      onUpdate(editor.getHTML());
    },
    editorProps: {
    attributes: {
      spellcheck: 'false',
      class: 'ProseMirror',
    },
  },
  });

  if (!editor) return null;

  const handleCopy = async () => {
    if (!editor) return;
    try {
      const text = editor.getText();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  return (
    <div className="editor-wrapper">
      {/* Toolbar */}
      <div className="flex justify-between toolbar">
        <div>
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'active' : ''}
        >
          Bold
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'active' : ''}
        >
          Italic
        </button>
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={editor.isActive('underline') ? 'active' : ''}
        >
          Underline
        </button>
        <button
          onClick={() => editor.chain().focus().setParagraph().run()}
          className={editor.isActive('paragraph') ? 'active' : ''}
        >
          ¶
        </button>
        <select 
           onChange={(e) => {
            const level = parseInt(e.target.value, 10);
            if (level === 0) {
                editor.chain().focus().setParagraph().run();
            } else {
                editor.chain().focus().toggleHeading({level: level as 1 | 2 | 3}).run();
            }
           }}  
           value={
            editor.isActive('heading', {level: 1}) ? '1' : 
            editor.isActive('heading', {level: 2}) ? '2' : 
            editor.isActive('heading', {level: 3}) ? '3' :
            '0'
           } 
           className='p-1 rounded border text-sm'
        >
            <option value="0">Paragraph</option>
            <option value="1">Heading 1</option>
            <option value="2">Heading 2</option>
            <option value="3">Heading 3</option>
        </select>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'active' : ''}
        >
          • List
        </button>
        </div>
        <div>
          <button onClick={handleCopy} className="flex items-center gap-1 p-1 hover:bg-gray-100 rounded"
            aria-label="Copy to clipboard">
            <ClipboardIcon copied={copied}/>
          {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Editor Area */}
      <EditorContent editor={editor} className="w-full h-full editor-box text-gray-100 " />
    </div>
  );
}
