interface CreateRoomButtonProps {
  onClick: () => void;
  isCreating: boolean;
}

export function CreateRoomButton({ onClick, isCreating }: CreateRoomButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={isCreating}
      className="group relative flex items-center justify-center bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 disabled:from-emerald-800 disabled:to-emerald-900 text-white px-4 py-2 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-emerald-500/25 text-white px-4 py-2 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-cyan-500/25 disabled:cursor-not-allowed transform hover:scale-105 overflow-hidden"
    >
      <div className="absolute inset-0 bg-white/10 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-500"></div>
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