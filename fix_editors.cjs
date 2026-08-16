const fs = require('fs');

// 1. Fix Editor.tsx
let editorTsx = fs.readFileSync('src/components/Editor/Editor.tsx', 'utf8');
editorTsx = editorTsx.replace(
  'className="editor-wrapper flex flex-col h-full quill-dark-theme relative bg-gray-800/10 rounded-lg overflow-hidden shadow-sm"',
  'className="editor-wrapper flex flex-col h-full quill-dark-theme relative w-full"'
);
fs.writeFileSync('src/components/Editor/Editor.tsx', editorTsx);

// 2. Fix editor.css
let editorCss = fs.readFileSync('src/components/Editor/editor.css', 'utf8');
editorCss = editorCss.replace(
  /background: rgba\(31, 41, 55, 0\.4\);\s*box-shadow: inset [^;]+;\s*overflow: hidden;\s*transition: [^;]+;/g,
  'background: transparent;\n  box-shadow: none;\n  overflow: hidden;'
);
editorCss = editorCss.replace(
  /.quill-dark-theme:focus-within {[\s\S]*?}/g,
  '.quill-dark-theme:focus-within {\n  box-shadow: none;\n  background: transparent;\n}'
);
editorCss = editorCss.replace(
  /background: rgba\(17, 24, 39, 0\.7\);\s*backdrop-filter: blur\(12px\);\s*-webkit-backdrop-filter: blur\(12px\);\s*border: none;\s*border-bottom: 1px solid rgba\(255, 255, 255, 0\.05\);\s*padding: 10px 16px;/g,
  'background: transparent;\n  border: none;\n  border-bottom: 1px solid rgba(255, 255, 255, 0.1);\n  padding: 0 0 12px 0;\n  margin-bottom: 12px;'
);
editorCss = editorCss.replace(
  /padding: 24px 32px;/g,
  'padding: 0 8px;'
);
editorCss = editorCss.replace(
  /left: 32px;/g,
  'left: 8px;'
);
fs.writeFileSync('src/components/Editor/editor.css', editorCss);

// 3. Fix CollabEditor.tsx
let collab = fs.readFileSync('src/components/CollabEditor.tsx', 'utf8');
// Replace icons import
collab = collab.replace(
  "import { WebsocketProvider } from'y-websocket';",
  "import { WebsocketProvider } from'y-websocket';\nimport { Bold, Italic, Underline as UnderlineIcon, Pilcrow, List, Copy, Check } from 'lucide-react';"
);
// Replace ClipboardIcon
collab = collab.replace(
  /const ClipboardIcon = \(\{ copied \}: \{ copied: boolean \}\) => \([\s\S]*?\);\n/g,
  'const ClipboardIcon = ({ copied }: { copied: boolean }) => (\n  copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />\n);\n'
);
// Replace Wrapper
collab = collab.replace(
  '<div className="editor-wrapper flex flex-col h-full">',
  '<div className="editor-wrapper flex flex-col h-full w-full">'
);
// Replace Toolbar
collab = collab.replace(
  '<div className="flex flex-wrap items-center gap-2 p-2 relative z-20 bg-gray-800 border-b border-gray-700/50 rounded-t-lg backdrop-blur-sm shadow-md justify-between">',
  '<div className="flex flex-wrap items-center gap-1.5 pb-3 mb-3 border-b border-gray-700/50 justify-between">'
);
// Replace Buttons
collab = collab.replace(/>\s*B\s*<\/button>/g, '><Bold size={16} strokeWidth={2.5} /></button>');
collab = collab.replace(/>\s*I\s*<\/button>/g, '><Italic size={16} strokeWidth={2.5} /></button>');
collab = collab.replace(/>\s*U\s*<\/button>/g, '><UnderlineIcon size={16} strokeWidth={2.5} /></button>');
collab = collab.replace(/>\s*¶\s*<\/button>/g, '><Pilcrow size={16} /></button>');
collab = collab.replace(/<span className="text-lg leading-none">•<\/span> List/g, '<List size={18} />');

// Clean up toolbar button classes
collab = collab.replace(
  /className={`p-1.5 rounded-md (font-medium |italic font-serif |underline underline-offset-2 )?\$\{editor.isActive\('[^']+'\)\s*\?'bg-blue-500\/20 text-blue-400 shadow-sm border border-blue-500\/20'\s*:'text-gray-400 hover:bg-gray-700 hover:text-gray-200'\s*\}`}/g,
  (match) => {
    return match.replace(/shadow-sm border border-blue-500\/20/g, '')
                 .replace(/(font-medium |italic font-serif |underline underline-offset-2 )/g, 'transition-colors ')
                 .replace(/hover:bg-gray-700/g, 'hover:bg-gray-700/50 hover:text-white');
  }
);

// Clean up select
collab = collab.replace(
  /className='p-1.5 rounded-md border border-gray-600 bg-gray-700 text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'/g,
  "className='p-1 rounded bg-transparent text-gray-300 text-sm focus:outline-none cursor-pointer hover:text-white hover:bg-gray-700/50 transition-colors border-none'"
);

// Clean up editor area container
collab = collab.replace(
  '<div className="flex-1 overflow-auto bg-gray-800/50 p-2">',
  '<div className="flex-1 overflow-auto bg-transparent px-2">'
);

// Clean up footer
collab = collab.replace(
  '<div className="p-2 text-xs text-gray-500 border-t border-gray-700 mt-auto flex justify-between">',
  '<div className="text-[10px] text-gray-500 mt-2 flex justify-between opacity-50 px-2">'
);

fs.writeFileSync('src/components/CollabEditor.tsx', collab);
console.log('Fixed CollabEditor, Editor, and editor.css');
