"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { chatServerState, chatState, chatSubscribe } from "@/lib/chat";

const BEAT_MS = 20_000;

/**
 * While the app is open and in front, tells the server so (every 20 s):
 * which chat is open, and whether you're on your notifications or one of
 * your posts. /api/push/send then doesn't buzz you about what you're
 * already looking at. One row, overwritten each time and marked left when
 * the app goes to the background; nothing else is kept (migration 068).
 */
export function PushPresence({ userId }: { userId: string }) {
  const pathname = usePathname();
  const chat = useSyncExternalStore(chatSubscribe, chatState, chatServerState);
  const conversationId = chat.open && chat.target.view === "conversation" ? chat.target.conversationId : null;
  // Only the screens a notification can be about.
  const screen = pathname === "/notifications" || pathname.startsWith("/u/") ? pathname : null;

  const now = useRef({ screen, conversationId });
  now.current = { screen, conversationId };

  useEffect(() => {
    const supabase = createClient();
    let broken = false;
    const beat = () => {
      if (broken || document.visibilityState !== "visible") return;
      void supabase
        .from("push_presence")
        .upsert({ user_id: userId, seen_at: new Date().toISOString(), left_at: null, screen: now.current.screen, conversation_id: now.current.conversationId })
        .then(({ error }) => {
          // Not there yet (before migration 068): stop trying.
          if (error?.code === "42P01" || error?.code === "PGRST205") broken = true;
        });
    };
    const leave = () => {
      if (broken) return;
      void supabase.from("push_presence").update({ left_at: new Date().toISOString() }).eq("user_id", userId);
    };
    const onVisibility = () => (document.visibilityState === "visible" ? beat() : leave());
    beat();
    const timer = setInterval(beat, BEAT_MS);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", leave);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", leave);
    };
  }, [userId]);

  // A new screen or chat counts straight away.
  const key = `${screen}|${conversationId}`;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (document.visibilityState !== "visible") return;
    void createClient()
      .from("push_presence")
      .upsert({ user_id: userId, seen_at: new Date().toISOString(), left_at: null, screen, conversation_id: conversationId })
      .then(() => {});
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
