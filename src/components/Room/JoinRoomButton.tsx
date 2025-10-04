interface JoinRoomButtonProps {
    onClick: () => void,
    isJoining: boolean
}

export function JoinRoomButton({ onClick, isJoining = false }: JoinRoomButtonProps) {
  return (
    <button
  onClick={onClick}
  disabled={isJoining}
  className="group relative flex items-center justify-center bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 disabled:from-cyan-800 disabled:to-cyan-900 text-white px-4 py-2 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-cyan-500/25 disabled:cursor-not-allowed transform hover:scale-105 overflow-hidden"
>

      <div className="absolute inset-0 bg-white/10 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-500"></div>
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