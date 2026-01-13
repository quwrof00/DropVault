import { useNavigate } from "react-router-dom";
import { useAuthUser } from "../hooks/useAuthUser";
import { useState } from "react";

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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-1 h-1 bg-white rounded-full animate-ping"></div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] bg-black text-white font-sans selection:bg-white/20 overflow-hidden flex flex-col lg:grid lg:grid-cols-4">
      {/* Subtle background noise/gradient */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-gray-900/40 via-black to-black -z-10" />

      {/* Center Column (3) - Main Content */}
      <div className="col-span-1 lg:col-span-3 flex flex-col relative h-full">
        {/* Added specific padding-left to balance the missing left column */}
        <main className="flex-1 flex flex-col justify-center px-12 md:px-32">
          <h1 className="text-6xl md:text-8xl lg:text-9xl font-medium tracking-tighter text-white mb-8 leading-[0.85]">
            Private.<br />
            Secure.<br />
            <span className="text-gray-800">Yours.</span>
          </h1>

          <p className="text-lg text-gray-500 max-w-lg font-normal leading-relaxed mb-12 ml-2">
            The minimalist workspace for your personal digital life.<br />
            Store notes, manage files, and write code.
          </p>

          <div className="flex flex-wrap gap-6 items-center ml-2">
            {user ? (
              <button
                onClick={() => handleNav("/main")}
                disabled={loading}
                className="bg-white text-black px-8 py-3 rounded-full font-bold text-sm hover:bg-gray-200 transition-all flex items-center gap-2"
              >
                {loading ? "LOADING..." : "ENTER DASHBOARD"}
              </button>
            ) : (
              <div className="flex items-center gap-6">
                <button
                  onClick={() => handleNav("/register")}
                  disabled={loading}
                  className="bg-white text-black px-8 py-3 rounded-full font-bold text-sm hover:bg-gray-200 transition-all flex items-center gap-2"
                >
                  {loading ? "PLEASE WAIT..." : "START FREE"}
                </button>
                <button
                  onClick={() => handleNav("/login")}
                  className="text-gray-500 hover:text-white text-sm font-medium transition-colors"
                >
                  LOGIN
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Right Column (1) - Features Grid & Status */}
      <div className="hidden lg:flex flex-col p-10 border-l border-white/5 h-full text-xs font-mono tracking-widest text-gray-500 bg-white/[0.01]">

        {/* Center Features - Pushed to center vertically */}
        <div className="flex flex-col gap-12 justify-center opacity-80 my-auto">
          <div>
            <h3 className="text-white mb-2">01. ENCRYPTED</h3>
            <p className="text-[10px] leading-relaxed opacity-60">
              AES-256 encryption at rest.<br />Your keys, your data.
            </p>
          </div>

          <div>
            <h3 className="text-white mb-2">02. PERFORMANCE</h3>
            <p className="text-[10px] leading-relaxed opacity-60">
              Built on edge computing.<br />Zero latency sync.
            </p>
          </div>

          <div>
            <h3 className="text-white mb-2">03. COLLABORATION</h3>
            <p className="text-[10px] leading-relaxed opacity-60">
              Real-time ephemeral rooms.<br />Secure by default.
            </p>
          </div>
        </div>

        {/* Bottom Meta - Stays at bottom */}
        <div className="text-right mt-auto">
          ENCRYPTED<br />AES-256
        </div>
      </div>
    </div>
  );
}