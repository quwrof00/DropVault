import Notes from "../Main/Notes";
import Files from "../Main/Files";
import Images from "../Main/Images";
import Codes from "../Main/Codes";

type MainAreaProps = {
  section: string;
  roomId?: string | null;
};

const MainArea = ({ section, roomId }: MainAreaProps) => {
  return (
    <div className="flex-1 border-l-2 border-black bg-gray-900 min-h-[calc(100vh-4rem)] md:min-h-screen rounded-none overflow-auto">
      <div className="bg-gray-900 rounded-lg shadow-sm p-4 sm:p-6 lg:p-8 mx-auto max-w-7xl">
        {section === "Notes" && <Notes roomId={roomId}/>}
        {section === "Images" && <Images roomId={roomId}/>}
        {section === "Files" && <Files roomId={roomId}/>}
        {section === "Code" && <Codes roomId={roomId}/>}
        {!section && (
          <p className="text-gray-500 text-center text-sm sm:text-base">
            Select a section from the sidebar to view content.
          </p>
        )}
      </div>
    </div>
  );
};

export default MainArea;