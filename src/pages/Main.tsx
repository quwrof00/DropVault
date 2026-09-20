import { useState } from "react";
import WorkspaceLayout from "../components/PageHelpers/WorkspaceLayout";

export function Main() {
  const [section, setSection] = useState<string>("Notes");

  return <WorkspaceLayout section={section} setSection={setSection} />;
}
export default Main;