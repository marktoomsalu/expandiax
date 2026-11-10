"use client";

import { MessageCircle } from "lucide-react";
import { openChat, type ChatPerson } from "@/lib/chat";
import { tapLight } from "@/lib/haptics";

/** "Ask Mark about Italy": opens the chat (or a postcard) with the place already stamped. */
export function AskAboutButton({ person, placeCode, placeName }: { person: ChatPerson; placeCode: string; placeName: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        tapLight();
        openChat({ view: "draft", person, place: { code: placeCode } });
      }}
      className="flex w-full items-center gap-3 rounded-2xl border border-accent/30 bg-accent-soft/60 px-4 py-3 text-left transition-colors hover:border-accent"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white" style={{ background: "linear-gradient(135deg, #fa51a2, #fb7822)" }}>
        <MessageCircle size={19} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block font-medium">
          Ask {person.display_name.split(" ")[0]} about {placeName}
        </span>
        <span className="block text-xs text-muted">Tips, places to eat, what to skip: straight from someone who&rsquo;s been.</span>
      </span>
    </button>
  );
}

/** "Message" on someone's profile: a chat with friends, a postcard otherwise. */
export function MessageButton({ person }: { person: ChatPerson }) {
  return (
    <button
      type="button"
      onClick={() => {
        tapLight();
        openChat({ view: "draft", person });
      }}
      className="btn-ghost !py-2 text-sm"
    >
      <MessageCircle size={15} aria-hidden /> Message
    </button>
  );
}
