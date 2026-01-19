import Notes from "../Main/Notes";
import Files from "../Main/Files";
import Images from "../Main/Images";
import Codes from "../Main/Codes";

type MainAreaProps = {
  section: string;
  roomId?: string | null;
};

const MainArea = ({ section, roomId }: MainAreaProps) => {
  // Notes and Codes manage their own full-height layout.
  // Files and Images are generally scrollable page content.
  const isFullPageApp = section === "Notes" || section === "Code";

  return (
    <div className={`flex-1 bg-gray-900 h-full w-full ${isFullPageApp ? 'overflow-hidden' : 'overflow-auto'}`}>
      {/* For specific apps like Notes/Codes, give them full space without padding */}
      {section === "Notes" && <Notes roomId={roomId} />}
      {section === "Code" && <Codes roomId={roomId} />}

      {/* For resource lists like Images/Files, use a container with padding */}
      {(section === "Images" || section === "Files") && (
        <div className="p-2 sm:p-6 lg:p-8 mx-auto max-w-7xl min-h-full">
          {section === "Images" && <Images roomId={roomId} />}
          {section === "Files" && <Files roomId={roomId} />}
        </div>
      )}

      {/* Default State */}
      {!section && (
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500 text-center text-sm sm:text-base">
            Select a section from the sidebar to view content.
          </p>
        </div>
      )}
    </div>
  );
};

export default MainArea;