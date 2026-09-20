import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import WorkspaceLayout from "../components/PageHelpers/WorkspaceLayout";

export function RoomMain() {
  const [section, setSection] = useState<string>("Notes");
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get("roomId");

  return (
    <WorkspaceLayout
      section={section}
      setSection={setSection}
      roomId={roomId}
      mobileTitleSuffix="(Room)"
    />
  );
}
export default RoomMain;