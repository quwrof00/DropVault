import Sidebar from "../components/Bars/Sidebar";
import MainArea from "../components/PageHelpers/MainArea";
import { useState } from "react";

export function Main() {
    const [section, setSection] = useState<string>("Notes");
    return (
        <div className="flex">
            <Sidebar onSelect={setSection}/>
            <MainArea section={section}/>
        </div>
    )
}
export default Main;