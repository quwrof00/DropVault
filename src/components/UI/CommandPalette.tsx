import { Command } from 'cmdk';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Folder, LogOut, Home, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { useRooms } from '../../hooks/useRooms';

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { rooms } = useRooms();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    
    const openMenu = () => setOpen(true);

    document.addEventListener('keydown', down);
    window.addEventListener('open-command-palette', openMenu);
    
    return () => {
      document.removeEventListener('keydown', down);
      window.removeEventListener('open-command-palette', openMenu);
    };
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm px-4" onClick={() => setOpen(false)}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <Command label="Global Command Menu" className="flex flex-col w-full h-full text-gray-200">
          <div className="flex items-center border-b border-gray-800 px-4 py-3">
            <Search className="w-5 h-5 text-gray-500 mr-3" />
            <Command.Input 
              autoFocus
              placeholder="Type a command or search..." 
              className="flex-1 bg-transparent border-none outline-none placeholder:text-gray-500 text-lg" 
            />
          </div>

          <Command.List className="max-h-[350px] overflow-y-auto p-2">
            <Command.Empty className="p-6 text-center text-sm text-gray-500">
              No results found.
            </Command.Empty>

            <Command.Group heading="Navigation" className="px-2 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <Command.Item 
                onSelect={() => runCommand(() => navigate('/dashboard'))}
                className="flex items-center px-3 py-2.5 rounded-lg cursor-pointer hover:bg-gray-800 data-[selected=true]:bg-blue-600/20 data-[selected=true]:text-blue-400 text-sm transition-colors"
              >
                <Home className="w-4 h-4 mr-3" />
                Go to Dashboard
              </Command.Item>
              <Command.Item 
                onSelect={() => runCommand(() => navigate('/main'))}
                className="flex items-center px-3 py-2.5 rounded-lg cursor-pointer hover:bg-gray-800 data-[selected=true]:bg-blue-600/20 data-[selected=true]:text-blue-400 text-sm transition-colors mt-1"
              >
                <Folder className="w-4 h-4 mr-3" />
                Go to Workspace
              </Command.Item>
              <Command.Item 
                onSelect={() => runCommand(() => navigate('/rooms'))}
                className="flex items-center px-3 py-2.5 rounded-lg cursor-pointer hover:bg-gray-800 data-[selected=true]:bg-blue-600/20 data-[selected=true]:text-blue-400 text-sm transition-colors mt-1"
              >
                <Users className="w-4 h-4 mr-3" />
                Go to Rooms
              </Command.Item>
            </Command.Group>

            {rooms && rooms.length > 0 && (
              <Command.Group heading="Your Rooms" className="px-2 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mt-2 border-t border-gray-800/50">
                {rooms.map((room) => (
                  <Command.Item 
                    key={room.id}
                    onSelect={() => runCommand(() => navigate(`/room?roomId=${room.id}`))}
                    className="flex items-center px-3 py-2.5 rounded-lg cursor-pointer hover:bg-gray-800 data-[selected=true]:bg-blue-600/20 data-[selected=true]:text-blue-400 text-sm transition-colors mt-1"
                  >
                    <Users className="w-4 h-4 mr-3" />
                    {room.name}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            <Command.Group heading="System" className="px-2 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mt-2 border-t border-gray-800/50">
              <Command.Item 
                onSelect={() => runCommand(async () => {
                  await supabase.auth.signOut();
                  navigate('/login');
                })}
                className="flex items-center px-3 py-2.5 rounded-lg cursor-pointer hover:bg-red-500/10 data-[selected=true]:bg-red-500/20 data-[selected=true]:text-red-400 text-sm text-red-400 transition-colors"
              >
                <LogOut className="w-4 h-4 mr-3" />
                Sign Out
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
