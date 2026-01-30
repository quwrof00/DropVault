import Sidebar from "../components/Bars/Sidebar";
import MainArea from "../components/PageHelpers/MainArea";
import { useState } from "react";

export function Main() {
    const [section, setSection] = useState<string>("Notes");
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <div className="flex flex-col md:flex-row bg-gray-900 h-[calc(100vh-4rem)] relative overflow-hidden">
            {/* Mobile Header - Just below Global Navbar */}
            <div className="md:hidden w-full bg-gray-950 border-b border-gray-800 flex items-center px-4 h-14 z-30 flex-shrink-0">
                <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="p-2 -ml-2 text-gray-400 hover:text-white focus:outline-none rounded-lg"
                    aria-label="Open menu"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
                <span className="ml-3 text-lg font-semibold text-gray-200">
                    {section}
                </span>
            </div>

            {/* Sidebar Container - Mobile Drawer / Desktop Static */}
            <div className={`
                fixed inset-y-0 left-0 z-50 md:z-0 w-72 bg-gray-950 shadow-2xl transition-transform duration-300 ease-in-out
                ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
                md:relative md:translate-x-0 md:flex md:w-auto md:shadow-none md:flex-col md:h-full
            `}>
                <Sidebar
                    onSelect={(s) => {
                        setSection(s);
                        setIsMobileMenuOpen(false);
                    }}
                    activeSection={section}
                    className="h-full"
                    onClose={() => setIsMobileMenuOpen(false)}
                />
            </div>

            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Main Content Area */}
            <div className="flex-1 w-full md:w-auto h-full overflow-hidden flex flex-col">
                <MainArea section={section} />
            </div>
        </div>
    )
}
export default Main;