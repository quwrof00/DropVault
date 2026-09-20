interface JoinRoomButtonProps {
 onClick: () => void,
 isJoining: boolean
}

export function JoinRoomButton({ onClick, isJoining = false }: JoinRoomButtonProps) {
 return (
 <button
 onClick={onClick}
 disabled={isJoining}
 className="group relative flex items-center justify-center bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 text-white px-4 py-2 rounded-xl font-semibold shadow-lg hover:shadow-cyan-500/25 disabled:cursor-not-allowed overflow-hidden"
>

 <div className="absolute inset-0 bg-white/10 -skew-x-12 -translate-x-full group-hover:translate-x-full"></div>
 <div className="relative flex items-center space-x-2">
 {isJoining ? (
 <>
 <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
 <span>Joining...</span>
 </>
 ) : (
 <>
 <span>Join</span>
 </>
 )}
 </div>
 </button>
 );
}