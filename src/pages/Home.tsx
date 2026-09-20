import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthUser } from "../hooks/useAuthUser";
import { Lock, Users, FileText, Folder, Code, Globe, ChevronRight } from "lucide-react";

export default function HomePage() {
  const navigate = useNavigate();
  const user = useAuthUser();
  const [activeFeature, setActiveFeature] = useState("notes");
  const [activeLang, setActiveLang] = useState("python");

  const features = [
    {
      id: "notes",
      name: "Encrypted Notes",
      icon: <FileText size={18} />,
      title: "Client-Side Encrypted Notes",
      description: "Markdown support with live preview. Client-side encryption ensures your thoughts remain private and inaccessible to anyone but you.",
      content: (
        <div className="w-full h-full min-h-[250px] bg-gray-950/80 rounded-2xl border border-gray-700 p-5 font-mono text-sm text-gray-400 overflow-hidden relative shadow-inner">
          <span className="text-blue-400">#</span> Research Notes<br /><br />
          <span className="text-emerald-400">- [x]</span> Analyze data structure<br />
          <span className="text-gray-600">- [ ]</span> Review security protocol
        </div>
      )
    },
    {
      id: "files",
      name: "File Vault",
      icon: <Folder size={18} />,
      title: "Secure File Storage",
      description: "Hierarchical file storage for any format. Secure, seamless management interface.",
      content: (
        <div className="w-full h-full min-h-[250px] bg-gray-950/80 rounded-2xl border border-gray-700 p-5 font-mono text-sm overflow-hidden relative shadow-inner">
          <div className="text-gray-400 space-y-2">
            <div className="flex items-center gap-2 text-purple-400"><Folder size={16} /> <span>End Semester Notes</span></div>
            <div className="pl-6 space-y-2 border-l border-gray-800 ml-2 mt-2">
              <div className="flex items-center gap-2 text-blue-400"><Folder size={16} /> <span>Mathematics</span></div>
              <div className="pl-6 space-y-2 border-l border-gray-800 ml-2 mt-2">
                <div className="flex items-center gap-2 text-gray-300"><FileText size={16} /> <span>Calculus</span></div>
                <div className="flex items-center gap-2 text-gray-300"><FileText size={16} /> <span>Algebra</span></div>
              </div>
              <div className="flex items-center gap-2 text-emerald-400 mt-2"><Folder size={16} /> <span>Computer Science</span></div>
              <div className="pl-6 space-y-2 border-l border-gray-800 ml-2 mt-2">
                <div className="flex items-center gap-2 text-gray-300"><FileText size={16} /> <span>Algorithms</span></div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "snippets",
      name: "Snippets",
      icon: <Code size={18} />,
      title: "Code Snippets",
      description: "Multi-language syntax highlighting & secure execution environments.",
      content: (
        <div className="w-full h-full min-h-[250px] bg-gray-950/80 rounded-2xl border border-gray-700 font-mono text-sm overflow-hidden relative shadow-inner flex flex-col">
          <div className="flex gap-4 border-b border-gray-800 px-4 py-3 bg-gray-900 text-xs font-semibold overflow-x-auto custom-scrollbar">
            {["python", "javascript", "cpp", "java"].map(lang => (
               <button 
                 key={lang}
                 onClick={() => setActiveLang(lang)}
                 className={`shrink-0 capitalize ${activeLang === lang ? "text-blue-400 border-b-2 border-blue-400 pb-1" : "text-gray-500 hover:text-gray-300 pb-1"}`}
               >
                 {lang}
               </button>
            ))}
          </div>
          <div className="p-5 flex-1 text-gray-300 space-y-1">
            {activeLang === "python" && <><span className="text-emerald-400">print</span>(<span className="text-yellow-400">"Hello, secure world!"</span>)</>}
            {activeLang === "javascript" && <><span className="text-blue-400">console</span>.<span className="text-emerald-400">log</span>(<span className="text-yellow-400">"Hello, secure world!"</span>);</>}
            {activeLang === "cpp" && <><span className="text-emerald-400">std::cout</span> <span className="text-purple-400">&lt;&lt;</span> <span className="text-yellow-400">"Hello, secure world!"</span> <span className="text-purple-400">&lt;&lt;</span> <span className="text-emerald-400">std::endl</span>;</>}
            {activeLang === "java" && <><span className="text-blue-400">System.out</span>.<span className="text-emerald-400">println</span>(<span className="text-yellow-400">"Hello, secure world!"</span>);</>}
          </div>
        </div>
      )
    },
    {
      id: "global",
      name: "Global Access",
      icon: <Globe size={18} />,
      title: "Access Anywhere",
      description: "Universal, seamless access from any authenticated device globally.",
      content: (
        <div className="w-full h-full min-h-[250px] flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-gray-700 rounded-2xl bg-gray-900/50">
           <Globe size={48} className="text-cyan-500 mb-4 opacity-50" />
           <p className="text-gray-400">Your vault syncs instantly across all your devices.</p>
        </div>
      )
    }
  ];

  return (
    <div className="bg-gray-950 text-gray-200 font-sans min-h-[calc(100vh-4rem)] p-2 md:p-4 selection:bg-blue-500/30">
      {/* Container matching WorkspaceLayout */}
      <div className="flex flex-col min-h-[calc(100vh-6rem)] bg-gray-900 text-white rounded-3xl border border-gray-800 shadow-2xl overflow-hidden relative">

        {/* Hero Section */}
        <div className="flex flex-col items-center justify-center py-20 px-6 border-b border-gray-800 bg-gray-900 min-h-[calc(100vh-6rem)] relative overflow-hidden">
          {/* Subtle Grid Background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

          {/* Vault/Security Radar Effect */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] md:w-[800px] md:h-[800px] pointer-events-none opacity-30">
            <div className="absolute inset-0 rounded-full border border-blue-500/30 animate-[ping_6s_ease-out_infinite]"></div>
            <div className="absolute inset-[15%] rounded-full border border-emerald-500/20 animate-[ping_6s_ease-out_infinite_2s]"></div>
            <div className="absolute inset-[30%] rounded-full border border-blue-500/10 animate-[ping_6s_ease-out_infinite_4s]"></div>
            
            {/* Center target crosshair */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 border border-blue-500/50 rounded-full"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-[1px] bg-blue-500/30"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-12 w-[1px] bg-blue-500/30"></div>
          </div>

          <div className="relative z-10 flex flex-col items-center w-full max-w-4xl">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 text-white">
              DROPVAULT
            </h1>

            <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed text-center mb-12">
              {user
                ? "Welcome back. Your secure workspace is ready."
                : "Your secure academic hub. Encrypted notes, code, and storage."}
            </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md">
            <button
              onClick={() => navigate(user ? "/main" : "/login")}
              className="flex items-center gap-3 px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-transform active:scale-95 w-full sm:w-auto justify-center shadow-lg"
            >
              <Lock className="w-4 h-4" />
              <span>{user ? "Enter Vault" : "Initialize Vault"}</span>
            </button>

            <button
              onClick={() => navigate("/rooms")}
              className="flex items-center gap-3 px-8 py-3.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 rounded-xl font-medium transition-transform active:scale-95 w-full sm:w-auto justify-center"
            >
              <Users className="w-4 h-4" />
              <span>Study Rooms</span>
            </button>
          </div>
        </div>
        </div>

        {/* Capabilities Section (Workspace Layout Clone) */}
        <div className="flex-1 flex flex-col md:flex-row bg-gray-900/50">
          {/* SubSidebar */}
          <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-gray-800 bg-gray-900 flex flex-col shrink-0">
             <div className="p-4 border-b border-gray-800">
               <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                 System Capabilities
               </h3>
             </div>
             <nav className="p-3 space-y-1">
               {features.map((feature) => (
                 <button
                   key={feature.id}
                   onClick={() => setActiveFeature(feature.id)}
                   className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                     activeFeature === feature.id
                       ? "bg-blue-600/10 text-blue-400"
                       : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                   }`}
                 >
                   <div className="flex items-center gap-3">
                     <span className={activeFeature === feature.id ? "opacity-100" : "opacity-70"}>
                       {feature.icon}
                     </span>
                     <span>{feature.name}</span>
                   </div>
                   {activeFeature === feature.id && <ChevronRight size={16} />}
                 </button>
               ))}
             </nav>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 p-6 md:p-10 flex flex-col justify-center">
            {features.map((feature) => (
              <div
                key={feature.id}
                className={`transition-opacity duration-300 w-full max-w-4xl mx-auto flex flex-col ${
                  activeFeature === feature.id ? "opacity-100 flex" : "opacity-0 hidden"
                }`}
              >
                <div className="mb-10">
                  <h2 className="text-3xl font-bold text-white mb-4">{feature.title}</h2>
                  <p className="text-lg text-gray-400 leading-relaxed max-w-2xl">
                    {feature.description}
                  </p>
                </div>
                
                <div className="flex-1 w-full max-w-2xl">
                  {feature.content}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
