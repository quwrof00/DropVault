import { useNavigate } from "react-router-dom";
import { useAuthUser } from "../hooks/useAuthUser";
import { useState } from "react";
import { FileText, Image, Folder, Code, Shield, Lock, ChevronRight, Terminal, Globe } from "lucide-react";

export default function HomePage() {
  const navigate = useNavigate();
  const user = useAuthUser();
  const [loading, setLoading] = useState(false);

  const handleNav = (path: string) => {
    setLoading(true);
    navigate(path);
    setLoading(false);
  };

  if (user === undefined) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#030303] text-gray-200 font-sans flex flex-col relative overflow-hidden p-4">
      {/* Grid Pattern Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-transparent to-transparent pointer-events-none" />

      {/* Main Content Container */}
      <div className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 z-10 py-4 lg:py-8 flex flex-col gap-6 lg:gap-8">

        {/* Hero Section - Tighter & Denser */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div className="space-y-6">

            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight text-white leading-[0.95]">
              Own your <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">
                digital footprint.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-gray-400 max-w-md leading-relaxed">
              A consolidated workspace for your sensitive data.
              Encrypted notes, decentralized storage, and code execution.
              <span className="block mt-2 text-gray-500 text-sm">No tracking. No ads. Just tools.</span>
            </p>

            <div className="flex items-center gap-4 pt-2">
              <button
                onClick={() => handleNav(user ? "/main" : "/register")}
                disabled={loading}
                className="group px-6 py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-all flex items-center gap-2"
              >
                {loading ? "PROCESSING..." : (user ? "ENTER VAULT" : "INITIALIZE")}
                <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>

              {!user && (
                <button
                  onClick={() => handleNav("/login")}
                  className="px-6 py-3 text-gray-400 hover:text-white font-medium transition-colors"
                >
                  ACCESS SYSTEM
                </button>
              )}
            </div>
          </div>

          {/* Abstract Visual / Feature Preview */}
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl blur opacity-20 animate-pulse"></div>
            <div className="relative bg-gray-900/80 backdrop-blur-xl border border-white/10 rounded-xl p-4 sm:p-6 grid grid-cols-2 gap-4">
              {/* Mock Dashboard Widgets */}
              <div className="col-span-2 bg-[#0A0A0A] border border-white/5 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-blue-500/20 flex items-center justify-center text-blue-400">
                    <Shield size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">Security Status</div>
                    <div className="text-xs text-green-400">AES-256 Active</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500 font-mono">ENCRYPTED</div>
              </div>

              <div className="bg-[#0A0A0A] border border-white/5 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-gray-400 mb-2">
                  <Folder size={14} />
                  <span className="text-xs font-mono">/STORAGE</span>
                </div>
                <div className="space-y-1.5">
                  <div className="h-1.5 w-3/4 bg-gray-800 rounded-full"></div>
                  <div className="h-1.5 w-1/2 bg-gray-800 rounded-full"></div>
                  <div className="h-1.5 w-2/3 bg-gray-800 rounded-full"></div>
                </div>
              </div>

              <div className="bg-[#0A0A0A] border border-white/5 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-gray-400 mb-2">
                  <Terminal size={14} />
                  <span className="text-xs font-mono">/CONSOLE</span>
                </div>
                <div className="text-[10px] font-mono text-green-500/50 leading-tight">
                  &gt; init_sequence<br />
                  &gt; loading_modules...<br />
                  &gt; ready
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bento Grid Features - Dense Layout */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 h-full">

          {/* Large Card: Secure Notes */}
          <div className="md:col-span-2 bg-gray-900/40 border border-white/5 hover:border-white/10 rounded-xl p-6 flex flex-col justify-between group transition-colors">
            <div className="mb-4">
              <FileText className="w-8 h-8 text-blue-400 mb-3" />
              <h3 className="text-xl font-bold text-white mb-1">Encrypted Notes</h3>
              <p className="text-sm text-gray-400">
                Markdown support with live preview. Your thoughts are encrypted client-side before they ever touch our servers.
              </p>
            </div>
            <div className="w-full h-24 bg-[#0A0A0A] rounded-lg border border-white/5 p-3 font-mono text-xs text-gray-500 overflow-hidden opacity-50 group-hover:opacity-80 transition-opacity">
              # Project Alpha<br />
              - [x] Secure database connection<br />
              - [ ] Implement zero-knowledge proof
            </div>
          </div>

          {/* Tall Card: File Storage */}
          <div className="md:row-span-2 bg-gray-900/40 border border-white/5 hover:border-white/10 rounded-xl p-6 flex flex-col group transition-colors">
            <div className="flex-1">
              <Folder className="w-8 h-8 text-yellow-400 mb-3" />
              <h3 className="text-xl font-bold text-white mb-1">File Vault</h3>
              <p className="text-sm text-gray-400 mb-4">
                Drag-and-drop storage for any file type. Organized in a hierarchical tree.
              </p>
            </div>
            <div className="space-y-2 mt-auto">
              <div className="flex items-center gap-2 p-2 rounded bg-white/5 text-xs text-gray-300">
                <Image size={12} className="text-purple-400" /> screenshot_2024.png
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-white/5 text-xs text-gray-300">
                <Code size={12} className="text-green-400" /> main.rs
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-white/5 text-xs text-gray-300">
                <Lock size={12} className="text-red-400" /> keys.pem
              </div>
            </div>
          </div>

          {/* Square Card: Code */}
          <div className="bg-gray-900/40 border border-white/5 hover:border-white/10 rounded-xl p-6 group transition-colors">
            <Code className="w-8 h-8 text-green-400 mb-3" />
            <h3 className="text-lg font-bold text-white mb-1">Snippets</h3>
            <p className="text-xs text-gray-400">
              Syntax highlighting for 100+ languages. Execute JS/TS/Python directly in the browser.
            </p>
          </div>

          {/* Square Card: Global */}
          <div className="bg-gray-900/40 border border-white/5 hover:border-white/10 rounded-xl p-6 group transition-colors">
            <Globe className="w-8 h-8 text-cyan-400 mb-3" />
            <h3 className="text-lg font-bold text-white mb-1">Access</h3>
            <p className="text-xs text-gray-400">
              Access your vault from any device. Mobile optimized. Instant sync.
            </p>
          </div>

          {/* Wide Card: Encryption Spec */}
          <div className="md:col-span-3 bg-gradient-to-r from-blue-900/10 to-indigo-900/10 border border-blue-500/10 rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                <Lock size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Zero-Knowledge Architecture</h4>
                <p className="text-xs text-gray-400">Your password never leaves your device.</p>
              </div>
            </div>
            <div className="hidden sm:block text-xs font-mono text-blue-300/50">
              SHA-256 • AES-GCM • ARGON2ID
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
