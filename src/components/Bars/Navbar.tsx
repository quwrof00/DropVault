import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase-client";
import { useAuthUser } from "../../hooks/useAuthUser";
import { useState } from "react";


export function Navbar() {
  const user = useAuthUser();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSignOut() {
    setIsSigningOut(true);
    setError(null);
    
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Sign out error:", error.message);
        setError("Failed to sign out. Please try again.");
      } else {
        navigate("/login");
      }
    } catch (err) {
      console.error("Unexpected sign out error:", err);
      setError("An unexpected error occurred during sign out.");
    } finally {
      setIsSigningOut(false);
    }
  }

  // Auto-clear error messages after 5 seconds
  useState(() => {
    if (error) {
      const timeout = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timeout);
    }
  });

  return (
    <>
      {/* Success/Error Messages */}
      {(success || error) && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
          {success && (
            <div className="bg-emerald-600/90 backdrop-blur-xl text-white px-6 py-4 rounded-2xl shadow-2xl border border-emerald-400/20 flex items-center space-x-3">
              <div className="w-6 h-6 bg-emerald-400 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-900" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="font-medium">{success}</span>
              <button 
                onClick={() => setSuccess(null)}
                className="ml-2 text-emerald-200 hover:text-white transition-colors p-1"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}
          {error && (
            <div className="bg-rose-600/90 backdrop-blur-xl text-white px-6 py-4 rounded-2xl shadow-2xl border border-rose-400/20 flex items-center space-x-3">
              <div className="w-6 h-6 bg-rose-400 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-rose-900" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="font-medium">{error}</span>
              <button 
                onClick={() => setError(null)}
                className="ml-2 text-rose-200 hover:text-white transition-colors p-1"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      <nav className="bg-slate-900/80 backdrop-blur-2xl border-b border-slate-700/50 sticky top-0 z-40 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left side - Logo and main nav */}
            <div className="flex items-center space-x-8">
              <button
                onClick={() => navigate("/")}
                className="group text-2xl font-bold font-mono tracking-tight bg-gradient-to-r from-white via-emerald-200 to-cyan-200 bg-clip-text text-transparent hover:from-emerald-300 hover:via-cyan-300 hover:to-blue-300 transition-all duration-300 transform hover:scale-105"
              >
                DROPVAULT
                <div className="h-0.5 w-0 group-hover:w-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-300 mt-1 mx-auto"></div>
              </button>

              {user && (
                <div className="flex items-center space-x-1">
                  <div className="w-px h-6 bg-slate-600"></div>
                  
                  <button
                    onClick={() => navigate("/main")}
                    className="flex items-center space-x-2 px-4 py-2 text-slate-300 hover:text-emerald-300 font-medium transition-all duration-200 rounded-xl hover:bg-slate-800/50 group"
                  >
                    <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>Vault</span>
                  </button>
                  
                  <button
                    onClick={() => navigate("/rooms")}
                    className="flex items-center space-x-2 px-4 py-2 text-slate-300 hover:text-cyan-300 font-medium transition-all duration-200 rounded-xl hover:bg-slate-800/50 group"
                  >
                    <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span>Rooms</span>
                  </button>
                  
                  
                </div>
              )}
            </div>

            {/* Right side - User actions */}
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <button
                    onClick={() => navigate("/dashboard")}
                    className="flex items-center space-x-2 px-4 py-2 text-slate-300 hover:text-orange-300 font-medium transition-all duration-200 rounded-xl hover:bg-slate-800/50 group"
                  >
                    <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>Dashboard</span>
                  </button>
                  
                  <div className="w-px h-6 bg-slate-600"></div>
                  
                  <button
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="group relative flex items-center space-x-2 bg-slate-800/60 hover:bg-slate-700/80 border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white px-4 py-2 rounded-xl font-medium transition-all duration-200 disabled:cursor-not-allowed transform hover:scale-105"
                  >
                    <div className="relative flex items-center space-x-2">
                      {isSigningOut ? (
                        <>
                          <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                          <span>Signing Out...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          <span>Sign Out</span>
                        </>
                      )}
                    </div>
                  </button>
                </>
              ) : (
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => navigate("/login")}
                    className="px-4 py-2 text-slate-300 hover:text-white font-medium transition-all duration-200 rounded-xl hover:bg-slate-800/50 transform hover:scale-105"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => navigate("/register")}
                    className="group relative px-6 py-2 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-emerald-500/25 transform hover:scale-105 overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-white/10 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-500"></div>
                    <span className="relative">Sign Up</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px) translateX(-50%);
          }
          to {
            opacity: 1;
            transform: translateY(0) translateX(-50%);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </>
  );
}