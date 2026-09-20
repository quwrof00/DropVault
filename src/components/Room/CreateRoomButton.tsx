interface CreateRoomButtonProps {
 onClick: () => void;
 isCreating: boolean;
}

export function CreateRoomButton({ onClick, isCreating }: CreateRoomButtonProps) {
 return (
 <button
 onClick={onClick}
 disabled={isCreating}
 className="group relative flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white px-4 py-2 rounded-xl font-semibold shadow-lg hover:shadow-cyan-500/25 disabled:cursor-not-allowed overflow-hidden"
 >
 <div className="absolute inset-0 bg-white/10 -skew-x-12 -translate-x-full group-hover:translate-x-full"></div>
 <div className="relative flex items-center space-x-2">
 {isCreating ? (
 <>
 <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
 <span>Creating...</span>
 </>
 ) : (
 <>
 <span>Create</span>
 </>
 )}
 </div>
 </button>
 );
}