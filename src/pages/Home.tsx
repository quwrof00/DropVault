import { useNavigate } from"react-router-dom";
import { useAuthUser } from"../hooks/useAuthUser";
import { Lock, Users, ArrowDown, FileText, Folder, Code, Globe, Image as ImageIcon } from"lucide-react";

export default function HomePage() {
 const navigate = useNavigate();
 const user = useAuthUser();

 const scrollToFeatures = () => {
 const featuresSection = document.getElementById('features');
 if (featuresSection) {
 featuresSection.scrollIntoView({ behavior:'smooth' });
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
 ?"Welcome back. Your secure workspace is ready."
 :"Your secure academic hub. Encrypted notes, code, and storage."}
 </p>

 {/* Buttons */}
 <div className="relative flex flex-col sm:flex-row items-center justify-center gap-5 mb-10 w-full max-w-md">
 <button
 onClick={() => navigate(user ?"/main" :"/login")}
 className="group flex items-center gap-3 px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium hover:scale-[1.02] active:scale-95 w-full sm:w-auto justify-center shadow-lg shadow-blue-900/20"
 >
 <Lock className="w-4 h-4" />
 <span>{user ?"Enter Vault" :"Initialize Vault"}</span>
 </button>

 <button
 onClick={() => navigate("/rooms")}
 className="group flex items-center gap-3 px-8 py-3.5 bg-gray-800/50 hover:bg-gray-800 text-gray-300 hover:text-white border border-gray-700/50 hover:border-gray-600 rounded-xl font-medium hover:scale-[1.02] active:scale-95 w-full sm:w-auto justify-center"
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
 className="mt-8 flex flex-col items-center gap-3 cursor-pointer group opacity-60 hover:opacity-100"
 onClick={scrollToFeatures}
 >
 <span className="text-gray-500 text-[10px] font-bold tracking-[0.2em] uppercase">Explore Features</span>
 <div className="w-8 h-8 rounded-full border border-gray-800 bg-gray-900/50 flex items-center justify-center group-hover:border-blue-500/30 group-hover:bg-blue-500/10 animate-bounce">
 <ArrowDown className="w-4 h-4 text-gray-400 group-hover:text-blue-400" />
 </div>
 </div>

 </div>
 </div>

  {/* Features Section */}
  <div id="features" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pb-32 pt-8">

    {/* Section Header */}
    <div className="text-center mb-20">
      <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">System Capabilities</h2>
      <div className="h-1 w-24 bg-gradient-to-r from-blue-500 via-emerald-500 to-cyan-500 mx-auto rounded-full opacity-80"></div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">

      {/* Large Card: Secure Notes */}
      <div className="md:col-span-2 bg-gray-800/40 backdrop-blur-md border border-white/5 hover:border-blue-500/40 rounded-3xl p-8 flex flex-col justify-between group hover:shadow-2xl hover:shadow-blue-900/20 transition-all duration-300 hover:-translate-y-1">
        <div className="mb-8">
          <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 text-blue-400 group-hover:scale-110 transition-transform duration-300">
            <FileText className="w-7 h-7" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-3">Encrypted Notes</h3>
          <p className="text-gray-400 text-base leading-relaxed">
            Markdown support with live preview. Client-side encryption ensures your thoughts remain private and inaccessible to anyone but you.
          </p>
        </div>
        <div className="w-full h-32 bg-gray-950/80 rounded-2xl border border-white/5 p-5 font-mono text-xs text-gray-400 overflow-hidden relative shadow-inner">
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-gray-950 to-transparent pointer-events-none"></div>
          <span className="text-blue-400">#</span> Research Notes<br /><br />
          <span className="text-emerald-400">- [x]</span> Analyze data structure<br />
          <span className="text-gray-600">- [ ]</span> Review security protocol
        </div>
      </div>

      {/* Tall Card: File Storage */}
      <div className="md:col-span-2 lg:col-span-1 lg:row-span-1 bg-gray-800/40 backdrop-blur-md border border-white/5 hover:border-yellow-500/40 rounded-3xl p-8 flex flex-col group hover:shadow-2xl hover:shadow-yellow-900/20 transition-all duration-300 hover:-translate-y-1">
        <div className="w-14 h-14 bg-yellow-500/10 rounded-2xl flex items-center justify-center mb-6 text-yellow-500 group-hover:scale-110 transition-transform duration-300">
          <Folder className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-bold text-white mb-3">File Vault</h3>
        <p className="text-gray-400 text-base leading-relaxed mb-8 flex-1">
          Hierarchical file storage for any format. Secure drag-and-drop powered interface.
        </p>
        <div className="space-y-3">
          <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-gray-950/60 border border-white/5 text-sm text-gray-300 shadow-sm">
            <ImageIcon size={16} className="text-purple-400" /> screenshot.png
          </div>
          <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-gray-950/60 border border-white/5 text-sm text-gray-300 shadow-sm">
            <Code size={16} className="text-emerald-400" /> main.rs
          </div>
        </div>
      </div>

      {/* Square Card: Code */}
      <div className="bg-gray-800/40 backdrop-blur-md border border-white/5 hover:border-emerald-500/40 rounded-3xl p-8 group hover:shadow-2xl hover:shadow-emerald-900/20 transition-all duration-300 hover:-translate-y-1">
        <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 text-emerald-400 group-hover:scale-110 transition-transform duration-300">
          <Code className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-bold text-white mb-3">Snippets</h3>
        <p className="text-gray-400 text-base leading-relaxed">
          Multi-language syntax highlighting & secure execution environments.
        </p>
      </div>

      {/* Square Card: Global */}
      <div className="bg-gray-800/40 backdrop-blur-md border border-white/5 hover:border-cyan-500/40 rounded-3xl p-8 group hover:shadow-2xl hover:shadow-cyan-900/20 transition-all duration-300 hover:-translate-y-1">
        <div className="w-14 h-14 bg-cyan-500/10 rounded-2xl flex items-center justify-center mb-6 text-cyan-400 group-hover:scale-110 transition-transform duration-300">
          <Globe className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-bold text-white mb-3">Access Anywhere</h3>
        <p className="text-gray-400 text-base leading-relaxed">
          Universal, seamless access from any authenticated device globally.
        </p>
      </div>

      {/* Wide Card: Encryption Spec */}
      <div className="md:col-span-2 lg:col-span-3 bg-gradient-to-r from-gray-800/60 to-gray-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 hover:border-white/20 transition-colors duration-300">
        <div className="flex items-center gap-6">
          <div className="p-4 bg-gray-950/50 rounded-2xl text-gray-300 border border-white/5 shadow-inner">
            <Lock size={28} className="text-emerald-400" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-white mb-1">Zero-Knowledge Architecture</h4>
            <p className="text-sm text-gray-400">Your data is encrypted locally. Keys never leave your device.</p>
          </div>
        </div>
        <div className="text-xs md:text-sm font-mono text-emerald-400/80 tracking-widest bg-emerald-500/10 py-3 px-6 rounded-2xl border border-emerald-500/20">
          SHA-256 • AES-GCM • ARGON2ID
        </div>
      </div>

    </div>
  </div>

 </div>
 );
}
