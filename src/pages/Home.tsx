import { useNavigate } from "react-router-dom";
import { useAuthUser } from "../hooks/useAuthUser";
import { Lock, Users, ArrowDown, FileText, Folder, Code, Globe, Image as ImageIcon } from "lucide-react";

export default function HomePage() {
  const navigate = useNavigate();
  const user = useAuthUser();

  const scrollToFeatures = () => {
    const featuresSection = document.getElementById('features');
    if (featuresSection) {
      featuresSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="bg-gray-950 text-gray-200 font-sans selection:bg-blue-500/30">

      {/* Hero Section */}
      <div className="relative min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center overflow-hidden py-16">
        {/* Background Gradients/Effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] md:w-[800px] h-[400px] md:h-[500px] bg-blue-900/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#030712_100%)] pointer-events-none" />

        {/* Main Card */}
        <div className="relative z-10 w-full max-w-4xl px-4 flex flex-col items-center">
          <div className="bg-gray-900/50 backdrop-blur-2xl border border-gray-800 rounded-3xl p-8 md:p-14 text-center shadow-2xl shadow-black/50 flex flex-col items-center w-full relative overflow-hidden">

            {/* Subtle inner gloss */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

            {/* Title */}
            <h1 className="relative text-5xl md:text-7xl font-bold tracking-tight mb-6 text-white drop-shadow-lg">
              DROPVAULT
            </h1>

            {/* Underline */}
            <div className="relative h-1 w-24 bg-gradient-to-r from-blue-500 to-emerald-400 mx-auto rounded-full mb-10 shadow-lg shadow-blue-500/20"></div>

            {/* Subtitle */}
            <p className="relative text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed mb-12 font-normal">
              {user
                ? "Welcome back. Your secure workspace is ready."
                : "Your secure academic hub. Encrypted notes, code, and storage."}
            </p>

            {/* Buttons */}
            <div className="relative flex flex-col sm:flex-row items-center justify-center gap-5 mb-10 w-full max-w-md">
              <button
                onClick={() => navigate(user ? "/main" : "/login")}
                className="group flex items-center gap-3 px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all hover:scale-[1.02] active:scale-95 w-full sm:w-auto justify-center shadow-lg shadow-blue-900/20"
              >
                <Lock className="w-4 h-4" />
                <span>{user ? "Enter Vault" : "Initialize Vault"}</span>
              </button>

              <button
                onClick={() => navigate("/rooms")}
                className="group flex items-center gap-3 px-8 py-3.5 bg-gray-800/50 hover:bg-gray-800 text-gray-300 hover:text-white border border-gray-700/50 hover:border-gray-600 rounded-xl font-medium transition-all hover:scale-[1.02] active:scale-95 w-full sm:w-auto justify-center"
              >
                <Users className="w-4 h-4" />
                <span>Study Rooms</span>
              </button>
            </div>

            {/* Bottom Banner */}
            <div className="relative w-full max-w-xl bg-gray-950/50 border border-gray-800/50 rounded-xl py-3 px-4 flex items-center justify-center gap-2 text-gray-400/80 text-sm">
              <span>Ready for your next session?</span>
            </div>

          </div>

          {/* Explore Features - Connected Indicator */}
          <div
            className="mt-8 flex flex-col items-center gap-3 cursor-pointer group opacity-60 hover:opacity-100 transition-opacity"
            onClick={scrollToFeatures}
          >
            <span className="text-gray-500 text-[10px] font-bold tracking-[0.2em] uppercase">Explore Features</span>
            <div className="w-8 h-8 rounded-full border border-gray-800 bg-gray-900/50 flex items-center justify-center group-hover:border-blue-500/30 group-hover:bg-blue-500/10 transition-colors animate-bounce">
              <ArrowDown className="w-4 h-4 text-gray-400 group-hover:text-blue-400" />
            </div>
          </div>

        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pb-24 pt-0">

        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">System Capabilities</h2>
          <div className="h-0.5 w-16 bg-gray-800 mx-auto rounded-full"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Large Card: Secure Notes */}
          <div className="md:col-span-2 bg-gray-900 border border-gray-800 hover:border-blue-500/30 rounded-2xl p-6 flex flex-col justify-between group transition-all duration-300 hover:shadow-xl hover:shadow-blue-900/5">
            <div className="mb-6">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4 text-blue-400 group-hover:scale-105 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Encrypted Notes</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Markdown support with live preview. Client-side encryption ensures your thoughts remain private.
              </p>
            </div>
            <div className="w-full h-28 bg-gray-950 rounded-xl border border-gray-800/50 p-3 font-mono text-[10px] text-gray-500 overflow-hidden relative opacity-70 group-hover:opacity-100 transition-opacity">
              <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-gray-950 to-transparent pointer-events-none"></div>
              # Research Notes<br />
              - [x] Analyze data structure<br />
              - [ ] Review security protocol
            </div>
          </div>

          {/* Tall Card: File Storage */}
          <div className="md:row-span-2 md:col-span-2 lg:col-span-1 lg:row-span-1 bg-gray-900 border border-gray-800 hover:border-yellow-500/30 rounded-2xl p-6 flex flex-col group transition-all duration-300 hover:shadow-xl hover:shadow-yellow-900/5">
            <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center mb-4 text-yellow-500 group-hover:scale-105 transition-transform">
              <Folder className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">File Vault</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-6 flex-1">
              Hierarchical file storage for any format. Drag-and-drop powered.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-950 border border-gray-800/50 text-xs text-gray-400">
                <ImageIcon size={12} className="text-purple-400" /> screenshot.png
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-950 border border-gray-800/50 text-xs text-gray-400">
                <Code size={12} className="text-emerald-400" /> main.rs
              </div>
            </div>
          </div>

          {/* Square Card: Code */}
          <div className="bg-gray-900 border border-gray-800 hover:border-emerald-500/30 rounded-2xl p-6 group transition-all duration-300 hover:shadow-xl hover:shadow-emerald-900/5">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center mb-4 text-emerald-400 group-hover:scale-105 transition-transform">
              <Code className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Snippets</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Multi-language syntax highlighting & JS execution environment.
            </p>
          </div>

          {/* Square Card: Global */}
          <div className="bg-gray-900 border border-gray-800 hover:border-cyan-500/30 rounded-2xl p-6 group transition-all duration-300 hover:shadow-xl hover:shadow-cyan-900/5">
            <div className="w-10 h-10 bg-cyan-500/10 rounded-lg flex items-center justify-center mb-4 text-cyan-400 group-hover:scale-105 transition-transform">
              <Globe className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Access</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Universal access from any authenticated device.
            </p>
          </div>

          {/* Wide Card: Encryption Spec */}
          <div className="md:col-span-3 bg-gradient-to-r from-gray-900 to-gray-800 border border-gray-800 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-gray-950 rounded-lg text-gray-400 border border-gray-800">
                <Lock size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Zero-Knowledge Architecture</h4>
                <p className="text-xs text-gray-400">Encryption keys stay on your device.</p>
              </div>
            </div>
            <div className="hidden sm:block text-[10px] font-mono text-gray-500 tracking-wider">
              SHA-256 • AES-GCM • ARGON2ID
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
