import { useEffect } from "react";
import * as Y from "yjs";
import { supabase } from "../lib/supabase-client";

export function usePersistentYDoc(doc: Y.Doc, roomId: string, fileName: string) {
  // Save everytime Yjs document changes
  useEffect(() => {
    let timeout: any;

    const save = async () => {
      const update = Y.encodeStateAsUpdate(doc);

      await supabase
        .from("notes")
        .upsert({
          room_id: roomId,
          title: fileName,
          ydoc: update,
        });
    };

    const observer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(save, 1000); // save after 1s idle
    };

    doc.on("update", observer);

    return () => {
      doc.off("update", observer);
      clearTimeout(timeout);
    };
  }, [doc, roomId, fileName]);

  // Load on startup
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("notes")
        .select("ydoc")
        .eq("room_id", roomId)
        .eq("title", fileName)
        .maybeSingle();

      if (data?.ydoc) {
        Y.applyUpdate(doc, data.ydoc);
      }
    };

    load();
  }, [doc, roomId, fileName]);
}
