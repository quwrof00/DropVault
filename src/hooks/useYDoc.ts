import { useEffect, useRef } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

export function useYDoc(roomId: string, fileName: string) {
  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const ytextRef = useRef<Y.Text | null>(null);

  useEffect(() => {
    const doc = new Y.Doc();
    const provider = new WebsocketProvider(
      "ws://localhost:1234",
      `${roomId}:${fileName}`,
      doc
    );

    const ytext = doc.getText("content");

    docRef.current = doc;
    providerRef.current = provider;
    ytextRef.current = ytext;

    return () => {
      provider.destroy();
      doc.destroy();
    };
  }, [roomId, fileName]);

  return {
    doc: docRef.current || null,
    provider: providerRef.current || null,
    ytext: ytextRef.current || null,
  };
}
