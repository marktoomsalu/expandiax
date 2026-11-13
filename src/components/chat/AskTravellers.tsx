"use client";

import Image from "next/image";
import { Mail, MessageCircle } from "lucide-react";
import { openChat, type ChatPerson } from "@/lib/chat";
import { tapLight } from "@/lib/haptics";
import { useChatEnabled } from "@/lib/useChatEnabled";

export type AskPerson = ChatPerson & { following: boolean; lived: boolean };

/**
 * "Ask a friend who's been": the people who've been to a country, the ones
 * you follow first. Tapping one opens a chat with the country already
 * stamped on it (a postcard, for someone who isn't a friend yet), in place
 * of the general questions board.
 */
export function AskTravellers({ people, placeCode, placeName }: { people: AskPerson[]; placeCode: string; placeName: string }) {
  if (!useChatEnabled() || people.length === 0) return null;
  const known = people.some((p) => p.following);
  const shown = [...people].sort((a, b) => Number(b.following) - Number(a.following) || Number(b.lived) - Number(a.lived)).slice(0, 12);

  return (
    <section className="mt-12 overflow-hidden rounded-3xl border border-accent/25 bg-gradient-to-br from-accent-soft/70 to-surface p-5" aria-labelledby="ask-h">
      <h2 id="ask-h" className="flex items-center gap-2 text-2xl">
        {known ? <MessageCircle size={20} className="text-accent" aria-hidden /> : <Mail size={20} className="text-accent" aria-hidden />}
        {known ? "Ask a friend who’s been" : "Send a postcard to someone who’s been"}
      </h2>
      <p className="mt-1 text-sm text-muted">
        Going to {placeName}? Tips, places to eat, what to skip: straight from someone who knows it.
        {known ? " People you follow first." : ""}
      </p>
      <ul className="no-scrollbar -mx-5 mt-4 flex gap-3 overflow-x-auto px-5 pb-1">
        {shown.map((p) => (
          <li key={p.id} className="shrink-0">
            <button
              type="button"
              onClick={() => {
                tapLight();
                openChat({ view: "draft", person: { id: p.id, username: p.username, display_name: p.display_name, avatar_url: p.avatar_url }, place: { code: placeCode } });
              }}
              className="flex w-24 flex-col items-center gap-1.5 rounded-2xl border border-line bg-surface px-2 py-3 text-center transition-colors hover:border-accent"
            >
              <span className="relative h-12 w-12 overflow-hidden rounded-full bg-raised ring-2 ring-white dark:ring-surface">
                {p.avatar_url ? (
                  <Image src={p.avatar_url} alt="" fill sizes="48px" className="object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center font-serif text-lg text-accent">{p.display_name.slice(0, 1)}</span>
                )}
              </span>
              <span className="w-full truncate text-xs font-medium">{p.display_name.split(" ")[0]}</span>
              <span className="text-[10px] text-muted">{p.lived ? "Lived there" : p.following ? "You follow" : "Has been"}</span>
              <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-white">
                {p.following ? <MessageCircle size={11} aria-hidden /> : <Mail size={11} aria-hidden />} {p.following ? "Ask" : "Postcard"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
