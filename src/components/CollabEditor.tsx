import { useEffect, useState } from "react";
import { useYDoc } from "../hooks/useYDoc";

export default function CollabEditor({
  roomId,
  fileName,
}: {
  roomId: string;
  fileName: string;
}) {
  const { ytext } = useYDoc(roomId, fileName);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!ytext) return;

    const updateHandler = () => {
      setText(ytext.toString());
    };

    ytext.observe(updateHandler);
    setText(ytext.toString());

    return () => ytext.unobserve(updateHandler);
  }, [ytext]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setText(value);

    if (!ytext) return;

    ytext.delete(0, ytext.length);
    ytext.insert(0, value);
  };

  return (
    <div>
      <textarea
        value={text}
        onChange={handleChange}
        placeholder={`Editing: ${fileName}`}
        style={{
          width: "100%",
          height: "300px",
          padding: "10px",
          fontFamily: "monospace",
        }}
      />
      <div style={{ marginTop: 10 }}>Room: {roomId} | File: {fileName}</div>
    </div>
  );
}
