import { useNavigate } from "react-router-dom";
import { useAuthUser } from "../hooks/useAuthUser";
import { useState, useEffect } from "react";

export default function HomePage() {
  const navigate = useNavigate();
  const user = useAuthUser();
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentFeature, setCurrentFeature] = useState(0);

  // Auto-rotate features every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % 3);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleNavigation = async (path: string) => {
    setIsNavigating(true);
    setTimeout(() => {
      navigate(path);
      setIsNavigating(false);
    }, 300);
  };

  const features = [
    {
      icon: "🧠",
      title: "Smart Notes",
      description: "Encrypted note-taking with rich formatting and real-time sync across all your devices.",
      color: "emerald",
      gradient: "from-emerald-400 to-teal-400"
    },
    {
      icon: "🧑‍💻",
      title: "Code Editor",
      description: "Multi-language editor with syntax highlighting and integrated compiler for instant testing.",
      color: "orange",
      gradient: "from-orange-400 to-red-400"
    },
    {
      icon: "👥",
      title: "Collaboration",
      description: "Create private rooms to share notes, code, and collaborate with study groups seamlessly.",
      color: "cyan",
      gradient: "from-cyan-400 to-blue-400"
    }
  ];

  const stats = [
    { number: "10K+", label: "Active Students", icon: "👨‍🎓", color: "text-emerald-400" },
    { number: "50K+", label: "Notes Created", icon: "📝", color: "text-orange-400" },
    { number: "25K+", label: "Code Snippets", icon: "💻", color: "text-cyan-400" },
    { number: "5K+", label: "Study Rooms", icon: "🏠", color: "text-rose-400" }
  ];

  if (user === undefined) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-6">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-slate-700 border-t-emerald-400 rounded-full animate-spin"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-r-cyan-400 rounded-full animate-ping opacity-75"></div>
          </div>
          <p className="text-slate-300 text-lg font-medium animate-pulse">Loading DropVault...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24 overflow-hidden relative">
      {/* Animated Grid Background */}
      <div className="fixed inset-0 opacity-20">
        <div className="absolute inset-0" 
             style={{
               backgroundImage: `
                 linear-gradient(rgba(34, 197, 94, 0.1) 1px, transparent 1px),
                 linear-gradient(90deg, rgba(34, 197, 94, 0.1) 1px, transparent 1px)
               `,
               backgroundSize: '100px 100px',
               animation: 'grid-move 20s linear infinite'
             }}>
        </div>
      </div>

      {/* Floating Geometric Shapes */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Large floating orbs with slow movement */}
        <div 
          className="absolute w-96 h-96 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-full blur-3xl"
          style={{
            top: '10%',
            right: '10%',
            animation: 'float-slow 15s ease-in-out infinite'
          }}
        ></div>
        <div 
          className="absolute w-80 h-80 bg-gradient-to-r from-orange-500/10 to-rose-500/10 rounded-full blur-3xl"
          style={{
            bottom: '20%',
            left: '15%',
            animation: 'float-slow 18s ease-in-out infinite reverse'
          }}
        ></div>
        <div 
          className="absolute w-64 h-64 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-full blur-3xl"
          style={{
            top: '60%',
            right: '60%',
            animation: 'float-slow 12s ease-in-out infinite'
          }}
        ></div>

        {/* Geometric shapes */}
        <div 
          className="absolute w-20 h-20 border border-emerald-400/20 rotate-45"
          style={{
            top: '25%',
            left: '80%',
            animation: 'rotate-slow 25s linear infinite'
          }}
        ></div>
        <div 
          className="absolute w-16 h-16 bg-gradient-to-r from-orange-400/10 to-rose-400/10 rotate-12"
          style={{
            top: '70%',
            left: '5%',
            animation: 'rotate-slow 20s linear infinite reverse'
          }}
        ></div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes grid-move {
          0% { transform: translate(0, 0); }
          100% { transform: translate(100px, 100px); }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-20px) scale(1.1); }
        }
        @keyframes rotate-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(34, 197, 94, 0.3); }
          50% { box-shadow: 0 0 40px rgba(34, 197, 94, 0.6); }
        }
      `}</style>

      {/* Main Content */}
      <main className="container mx-auto px-4 relative z-10">
        {/* Hero Section */}
        <section className="flex flex-col items-center justify-center min-h-screen py-12">
          <div className="bg-slate-900/80 backdrop-blur-2xl p-8 md:p-12 w-full max-w-5xl rounded-3xl border border-slate-700/50 shadow-2xl relative overflow-hidden">
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-cyan-500/5 rounded-3xl"></div>
            
            <div className="text-center space-y-8 relative">
              <div className="space-y-6">
                <h1 className="text-5xl md:text-7xl font-bold mb-4 bg-gradient-to-r from-white via-emerald-200 to-cyan-200 bg-clip-text text-transparent font-mono tracking-tight">
                  DROPVAULT
                </h1>
                <div className="w-24 h-1 bg-gradient-to-r from-emerald-400 to-cyan-400 mx-auto rounded-full"></div>
                <p className="text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto leading-relaxed font-light">
                  {user ? (
                    <>Welcome back! Your secure academic hub awaits with all your notes, code, and collaborations.</>
                  ) : (
                    <>Your secure academic workspace for notes, code, and seamless collaboration.</>
                  )}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
                {user ? (
                  <>
                    <button
                      onClick={() => handleNavigation("/main")}
                      disabled={isNavigating}
                      className="group relative px-8 py-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-2xl font-semibold transition-all duration-300 shadow-lg hover:shadow-emerald-500/30 disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden transform hover:scale-105"
                    >
                      <div className="absolute inset-0 bg-white/10 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                      <div className="relative flex items-center space-x-3">
                        {isNavigating ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Opening...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            <span>Open Vault</span>
                          </>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={() => handleNavigation("/rooms")}
                      disabled={isNavigating}
                      className="group px-8 py-4 bg-slate-800/50 text-white border-2 border-slate-600 hover:border-cyan-400 rounded-2xl font-semibold hover:text-cyan-300 transition-all duration-300 hover:bg-cyan-400/10 disabled:opacity-70 disabled:cursor-not-allowed transform hover:scale-105"
                    >
                      <div className="flex items-center space-x-3">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span>Study Rooms</span>
                      </div>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleNavigation("/register")}
                      disabled={isNavigating}
                      className="group relative px-8 py-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-2xl font-semibold transition-all duration-300 shadow-lg hover:shadow-emerald-500/30 disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden transform hover:scale-105"
                    >
                      <div className="absolute inset-0 bg-white/10 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                      <div className="relative flex items-center space-x-3">
                        {isNavigating ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Loading...</span>
                          </>
                        ) : (
                          <>
                            <span>Get Started</span>
                            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={() => handleNavigation("/login")}
                      disabled={isNavigating}
                      className="group px-8 py-4 bg-slate-800/50 text-white border-2 border-slate-600 hover:border-cyan-400 rounded-2xl font-semibold hover:text-cyan-300 transition-all duration-300 hover:bg-cyan-400/10 disabled:opacity-70 disabled:cursor-not-allowed transform hover:scale-105"
                    >
                      <div className="flex items-center space-x-3">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                        <span>Sign In</span>
                      </div>
                    </button>
                  </>
                )}
              </div>

              {/* User greeting */}
              {user && (
                <div className="mt-8 p-6 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-2xl backdrop-blur-sm">
                  <p className="text-emerald-200 text-lg font-light">
                    Ready to continue your learning journey? ✨
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Modern scroll indicator */}
          <div className="mt-16 group cursor-pointer" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
            <div className="flex flex-col items-center space-y-2 text-emerald-400 group-hover:text-emerald-300 transition-colors">
              <span className="text-sm font-medium opacity-70">Explore Features</span>
              <div className="animate-bounce">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        {!user && (
          <section className="py-20">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
              {stats.map((stat, index) => (
                <div key={index} className="group text-center p-8 bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-slate-700/50 hover:border-emerald-400/30 transition-all duration-500 hover:transform hover:scale-105">
                  <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300 filter grayscale group-hover:grayscale-0">{stat.icon}</div>
                  <div className={`text-3xl md:text-4xl font-bold ${stat.color} mb-2 font-mono`}>{stat.number}</div>
                  <div className="text-slate-400 text-sm font-medium uppercase tracking-wide">{stat.label}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Features Section */}
        <section id="features" className="py-24">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
              {user ? "Your Toolkit" : "Features"}
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              {user ? "Everything you need for academic success" : "Built for the modern student workflow"}
            </p>
          </div>
         
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
              {/* Feature showcase */}
              <div className="order-2 lg:order-1">
                <div className="bg-slate-900/60 backdrop-blur p-8 rounded-2xl border border-slate-700/50 relative overflow-hidden">
                  <div className={`absolute inset-0 bg-gradient-to-br ${features[currentFeature].gradient} opacity-5 transition-opacity duration-300`}></div>
                  
                  <div className="relative">
                    <div className="text-6xl mb-6 text-center transition-all duration-300">
                      {features[currentFeature].icon}
                    </div>
                    <h3 className="text-2xl font-semibold mb-4 text-center text-white">
                      {features[currentFeature].title}
                    </h3>
                    <p className="text-slate-300 text-center leading-relaxed">
                      {features[currentFeature].description}
                    </p>
                    
                    {/* Progress indicators */}
                    <div className="flex justify-center space-x-2 mt-6">
                      {features.map((_, index) => (
                        <div
                          key={index}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            index === currentFeature ? 'w-8 bg-emerald-400' : 'w-1.5 bg-slate-600'
                          }`}
                        ></div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Feature navigation */}
              <div className="order-1 lg:order-2 space-y-4">
                {features.map((feature, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentFeature(index)}
                    className={`w-full text-left p-6 rounded-xl border transition-all duration-200 ${
                      currentFeature === index
                        ? `border-${feature.color}-400/50 bg-slate-800/60`
                        : 'border-slate-700/50 hover:border-slate-600 bg-slate-900/30 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-start space-x-4">
                      <div className="text-3xl">
                        {feature.icon}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold mb-2 text-white">
                          {feature.title}
                        </h4>
                        <p className="text-slate-400 text-sm leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24">
          <div className="text-center bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-2xl rounded-3xl p-16 border border-slate-700/50 shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-cyan-500/5 rounded-3xl"></div>
            
            <div className="relative">
              <h3 className="text-4xl md:text-5xl font-bold mb-8 bg-gradient-to-r from-white via-emerald-200 to-cyan-200 bg-clip-text text-transparent">
                {user ? "Ready to continue?" : "Transform your workflow"}
              </h3>
              <p className="text-xl text-slate-400 mb-12 max-w-3xl mx-auto font-light leading-relaxed">
                {user ? "Your digital workspace is ready and waiting" : "Join the next generation of academic productivity"}
              </p>
              <button
                onClick={() => handleNavigation(user ? "/main" : "/register")}
                disabled={isNavigating}
                className="group relative px-12 py-5 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xl rounded-2xl font-semibold transition-all duration-300 shadow-xl hover:shadow-emerald-500/30 disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden transform hover:scale-105"
              >
                <div className="absolute inset-0 bg-white/10 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                <div className="relative flex items-center space-x-3">
                  {isNavigating ? (
                    <>
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading...</span>
                    </>
                  ) : (
                    <>
                      <span>{user ? "Enter DropVault" : "Start Building"}</span>
                      <svg className="w-6 h-6 group-hover:translate-x-2 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </div>
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}