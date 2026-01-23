import { useEffect, useState, useCallback, useRef } from "react";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { supabase } from "../lib/supabase-client";
import { encrypt } from '../lib/crypto-helper';
import './Editor/editor.css';

const ClipboardIcon = ({ copied }: { copied: boolean }) => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    {copied ? (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    ) : (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
    )}
  </svg>
);

const COLORS = ['#958DF1', '#F98181', '#FBBC88', '#FAF594', '#70CFF8', '#94FADB', '#B9F18D'];
const getRandomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

// Internal component to handle the actual editor instance once provider is ready
function TiptapEditor({
  provider,
  doc,
  initialContent,
  roomId,
  fileName,
  onCopy,
  onSave
}: {
  provider: WebsocketProvider;
  doc: Y.Doc;
  initialContent?: string;
  roomId: string;
  fileName: string;
  onCopy: (text: string) => void;
  onSave: (content: string) => void;
}) {
  const lastSavedContent = useRef<string>("");
  const [copied, setCopied] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false, // History is handled by Yjs
      }),
      Underline,
      Collaboration.configure({
        document: doc,
      }),
      CollaborationCursor.configure({
        provider: provider,
        user: {
          name: 'Anonymous',
          color: getRandomColor(),
        },
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'ProseMirror outline-none h-full',
      },
    },
    onUpdate: ({ }) => {
      // Debounce logic can be handled here or by effect, but let's stick to effect for now or simple timeout
    }
  });

  // Debounced save
  useEffect(() => {
    if (!editor) return;

    const interval = setInterval(() => {
      const content = editor.getHTML();
      if (content !== lastSavedContent.current) {
        onSave(content);
        lastSavedContent.current = content;
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [editor, onSave]);

  const handleCopyBtn = () => {
    if (editor) {
      onCopy(editor.getText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (!editor) {
    return <div className="p-4 text-gray-400">Loading editor...</div>;
  }

  return (
    <div className="editor-wrapper flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-2 sticky top-0 z-20 bg-gray-800 border-b border-gray-700/50 rounded-t-lg backdrop-blur-sm shadow-md">
        <div className="flex items-center gap-1">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded-md transition-all duration-200 font-medium ${editor.isActive('bold')
              ? 'bg-blue-500/20 text-blue-400 shadow-sm border border-blue-500/20'
              : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
            title="Bold"
          >
            B
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded-md transition-all duration-200 italic font-serif ${editor.isActive('italic')
              ? 'bg-blue-500/20 text-blue-400 shadow-sm border border-blue-500/20'
              : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
            title="Italic"
          >
            I
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`p-1.5 rounded-md transition-all duration-200 underline underline-offset-2 ${editor.isActive('underline')
              ? 'bg-blue-500/20 text-blue-400 shadow-sm border border-blue-500/20'
              : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
            title="Underline"
          >
            U
          </button>

          <div className="w-px h-5 bg-gray-700 mx-1"></div>

          <button
            onClick={() => editor.chain().focus().setParagraph().run()}
            className={`p-1.5 px-2 rounded-md transition-all duration-200 ${editor.isActive('paragraph')
              ? 'bg-blue-500/20 text-blue-400 shadow-sm border border-blue-500/20'
              : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
            title="Paragraph"
          >
            ¶
          </button>
          <select
            onChange={(e) => {
              const level = parseInt(e.target.value, 10);
              if (level === 0) {
                editor.chain().focus().setParagraph().run();
              } else {
                editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 }).run();
              }
            }}
            value={
              editor.isActive('heading', { level: 1 }) ? '1' :
                editor.isActive('heading', { level: 2 }) ? '2' :
                  editor.isActive('heading', { level: 3 }) ? '3' :
                    '0'
            }
            className='p-1.5 rounded-md border border-gray-600 bg-gray-700 text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'
          >
            <option value="0">Normal</option>
            <option value="1">Heading 1</option>
            <option value="2">Heading 2</option>
            <option value="3">Heading 3</option>
          </select>

          <div className="w-px h-5 bg-gray-700 mx-1"></div>

          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded-md transition-all duration-200 flex items-center gap-1 ${editor.isActive('bulletList')
              ? 'bg-blue-500/20 text-blue-400 shadow-sm border border-blue-500/20'
              : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
            title="Bullet List"
          >
            <span className="text-lg leading-none">•</span> List
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-0.5 rounded-full border border-green-500/20 bg-green-500/10 text-green-400`}>
            Live
          </span>
          <button
            onClick={handleCopyBtn}
            className={`flex items-center gap-1.5 p-1.5 px-3 rounded-md transition-all duration-200 text-sm font-medium ${copied ? 'text-green-400' : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'}`}
            aria-label="Copy to clipboard"
          >
            <ClipboardIcon copied={copied} />
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 overflow-auto bg-gray-800/50 p-2">
        <EditorContent editor={editor} className="min-h-full editor-box text-gray-100" />
      </div>

      <div className="p-2 text-xs text-gray-500 border-t border-gray-700 mt-auto flex justify-between">
        <span>Room: {roomId}</span>
        <span>File: {fileName}</span>
      </div>
    </div>
  );
}

export default function CollabEditor({
  roomId,
  fileName,
  initialContent,
}: {
  roomId: string;
  fileName: string;
  initialContent?: string;
}) {
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const lastSavedContent = useRef<string>("");

  // Persistence Logic
  const saveToSupabase = useCallback(async (content: string) => {
    // Don't save empty content if it wasn't empty before (safety check)
    if (!content && lastSavedContent.current) return;

    console.log("Saving to Supabase:", fileName);
    try {
      const encrypted = await encrypt(content, roomId); // Encrypt with roomId as key for now

      const { error } = await supabase
        .from("notes")
        .upsert({
          room_id: roomId,
          title: fileName,
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          salt: encrypted.salt,
          updated_at: new Date().toISOString()
        }, { onConflict: 'room_id,title' });

      if (error) console.error("Error saving collab note:", error);
      else lastSavedContent.current = content;

    } catch (err) {
      console.error("Encryption/Save failed:", err);
    }
  }, [roomId, fileName]);

  // Doc and Provider Lifecycle
  useEffect(() => {
    const ydoc = new Y.Doc();
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:1234';
    const wsProvider = new WebsocketProvider(wsUrl, `${roomId}-${encodeURIComponent(fileName)}`, ydoc);

    setDoc(ydoc);
    setProvider(wsProvider);

    return () => {
      wsProvider.destroy();
      ydoc.destroy();
      setProvider(null);
      setDoc(null);
    };
  }, [roomId, fileName]);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  // Only render editor when provider and doc are ready
  if (!provider || !doc) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 space-x-2">
        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
        <span>Connecting to room...</span>
      </div>
    );
  }

  return (
    <TiptapEditor
      provider={provider}
      doc={doc}
      initialContent={initialContent}
      roomId={roomId}
      fileName={fileName}
      onCopy={handleCopy}
      onSave={saveToSupabase}
    />
  );
}
