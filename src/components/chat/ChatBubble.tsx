"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowUp, Ban, Flag, MapPin, MessageCircle, MoreHorizontal, PenSquare, Search, ShieldCheck, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { COUNTRIES, countryByCode } from "@/lib/countries";
import { tapLight, tapSuccess } from "@/lib/haptics";
import {
  chatServerState,
  chatState,
  chatSubscribe,
  closeChat,
  goChat,
  isIncomingPostcard,
  myReadAt,
  openChat,
  otherOf,
  type ChatPerson,
  type ChatPlace,
  type ConversationRow,
  type MessageRow,
} from "@/lib/chat";
import { cn } from "@/lib/utils";
import { chatProblem } from "@/lib/chatRules";
import { useChatEnabled } from "@/lib/useChatEnabled";

// Screens where the bubble would be in the way.
const HIDDEN = ["/start", "/touch", "/sign-in", "/sign-up", "/onboarding"];

const CONV_FIELDS = "id, a, b, status, started_by, last_message_at, a_read_at, b_read_at";

/** Everything the bubble and the list need, kept live. */
function useChat(me: string) {
  const supabase = useMemo(() => createClient(), []);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [people, setPeople] = useState<Record<string, ChatPerson>>({});
  const [last, setLast] = useState<Record<string, MessageRow>>({});
  const [friends, setFriends] = useState<ChatPerson[]>([]);
  const [incoming, setIncoming] = useState<MessageRow | null>(null);

  const load = useCallback(async () => {
    const { data: convs } = await supabase.from("conversations").select(CONV_FIELDS).order("last_message_at", { ascending: false }).limit(60);
    const list = (convs ?? []) as ConversationRow[];
    const ids = list.map((c) => c.id);
    const others = list.map((c) => otherOf(c, me));
    const { data: blockRows } = await supabase.from("blocks").select("blocked_id").eq("blocker_id", me);
    const blocked = new Set((blockRows ?? []).map((r) => r.blocked_id as string));
    // Someone you blocked is gone from your chats.
    const visible = list.filter((c) => !blocked.has(otherOf(c, me)));
    setConversations(visible);
    const [{ data: msgs }, { data: mine }] = await Promise.all([
      ids.length
        ? supabase.from("messages").select("*").in("conversation_id", ids).order("created_at", { ascending: false }).limit(400)
        : Promise.resolve({ data: [] as MessageRow[] }),
      supabase.from("follows").select("followee_id").eq("follower_id", me),
    ]);
    const lastBy: Record<string, MessageRow> = {};
    for (const m of (msgs ?? []) as MessageRow[]) if (!lastBy[m.conversation_id]) lastBy[m.conversation_id] = m;
    setLast(lastBy);
    const iFollow = (mine ?? []).map((r) => r.followee_id as string);
    const { data: back } = iFollow.length
      ? await supabase.from("follows").select("follower_id").eq("followee_id", me).in("follower_id", iFollow)
      : { data: [] as { follower_id: string }[] };
    const friendIds = (back ?? []).map((r) => r.follower_id as string);
    const want = [...new Set([...others, ...friendIds])];
    const { data: profs } = want.length
      ? await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", want)
      : { data: [] as ChatPerson[] };
    const byId: Record<string, ChatPerson> = {};
    for (const p of (profs ?? []) as ChatPerson[]) byId[p.id] = p;
    setPeople(byId);
    setFriends(friendIds.map((id) => byId[id]).filter(Boolean));
  }, [supabase, me]);

  useEffect(() => {
    void load();
    let timer: ReturnType<typeof setTimeout>;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void load(), 250);
    };
    const channel = supabase
      .channel(`chat-${me}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => {
        const m = p.new as MessageRow;
        if (m.sender_id !== me) setIncoming(m);
        soon();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, soon)
      .subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [supabase, me, load]);

  const unread = conversations.filter((c) => {
    const m = last[c.id];
    return m && m.sender_id !== me && m.created_at > myReadAt(c, me) && c.status !== "declined";
  });

  return { supabase, conversations, people, last, friends, unread, incoming, reload: load };
}

/** Only in the new app build (see useChatEnabled). */
export function ChatBubble({ me }: { me: string }) {
  const enabled = useChatEnabled();
  return enabled ? <ChatBubbleInner me={me} /> : null;
}

function ChatBubbleInner({ me }: { me: string }) {
  const path = usePathname();
  const s = useSyncExternalStore(chatSubscribe, chatState, chatServerState);
  const chat = useChat(me);

  // A tapped push lands on ?chat=<conversation>.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("chat");
    if (id) openChat({ view: "conversation", conversationId: id });
  }, [path]);

  if (HIDDEN.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  const first = chat.unread[0];
  const face = first ? chat.people[otherOf(first, me)] : null;

  return (
    <>
      {!s.open && (
        <button
          type="button"
          onClick={() => {
            tapLight();
            openChat(first && chat.unread.length === 1 ? { view: "conversation", conversationId: first.id } : { view: "home" });
          }}
          aria-label={chat.unread.length ? `Chat, ${chat.unread.length} unread` : "Chat"}
          className="chat-bubble fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl shadow-black/25 transition-transform active:scale-95"
          style={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom))", background: "linear-gradient(135deg, #fa51a2, #fb7822)" }}
        >
          {face ? (
            <span className="relative h-12 w-12 overflow-hidden rounded-full ring-2 ring-white">
              <Avatar p={face} size={48} />
            </span>
          ) : (
            <MessageCircle size={24} strokeWidth={2.2} />
          )}
          {chat.unread.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2b0b2e] px-1 text-[11px] font-bold ring-2 ring-white">
              {chat.unread.length}
            </span>
          )}
          {chat.unread.length > 0 && <span className="chat-ping absolute inset-0 rounded-full" aria-hidden />}
        </button>
      )}
      {s.open && <ChatPanel me={me} chat={chat} target={s.target} />}
      <style>{STYLES}</style>
    </>
  );
}

type Chat = ReturnType<typeof useChat>;

function ChatPanel({ me, chat, target }: { me: string; chat: Chat; target: ReturnType<typeof chatState>["target"] }) {
  // The phone's back gesture and Escape close it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeChat();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-end sm:p-5" role="dialog" aria-modal="true" aria-label="Chat">
      <button type="button" aria-label="Close chat" onClick={closeChat} className="absolute inset-0 bg-black/40 backdrop-blur-[2px] sm:bg-black/20" />
      <div
        className="chat-sheet relative flex w-full flex-col overflow-hidden rounded-t-[28px] bg-canvas shadow-2xl sm:h-[640px] sm:w-[400px] sm:rounded-[28px]"
        style={{ height: "min(88vh, 760px)" }}
      >
        {target.view === "home" && <Home me={me} chat={chat} />}
        {target.view === "new" && <NewChat me={me} chat={chat} />}
        {target.view === "conversation" && <Conversation key={target.conversationId} me={me} chat={chat} conversationId={target.conversationId} />}
        {target.view === "draft" && <Draft key={target.person.id} me={me} chat={chat} person={target.person} place={target.place ?? null} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Home({ me, chat }: { me: string; chat: Chat }) {
  const postcards = chat.conversations.filter((c) => isIncomingPostcard(c, me));
  const talks = chat.conversations.filter((c) => !isIncomingPostcard(c, me) && c.status !== "declined" && chat.last[c.id]);

  return (
    <>
      <header className="flex items-center justify-between px-5 pb-3 pt-5">
        <h2 className="font-serif text-2xl">Chats</h2>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => goChat({ view: "new" })} aria-label="New chat" className="flex h-10 w-10 items-center justify-center rounded-full text-accent hover:bg-raised">
            <PenSquare size={20} />
          </button>
          <button type="button" onClick={closeChat} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-raised">
            <X size={20} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-8">
        {postcards.length > 0 && (
          <section aria-label="Postcards" className="mb-6">
            <p className="eyebrow">Postcards for you</p>
            <div className="relative mt-3 h-40">
              {postcards.slice(0, 3).map((c, i) => {
                const who = chat.people[otherOf(c, me)];
                const m = chat.last[c.id];
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => goChat({ view: "conversation", conversationId: c.id })}
                    className="postcard absolute inset-x-0 top-0 mx-auto flex h-36 w-[92%] flex-col justify-between rounded-2xl p-4 text-left shadow-lg"
                    style={{ transform: `rotate(${[-2, 3, -4][i]}deg) translateY(${i * 6}px)`, zIndex: 10 - i }}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="line-clamp-3 font-serif text-base leading-snug text-[#2b0b2e]">&ldquo;{m?.body}&rdquo;</span>
                      <Stamp code={m?.place_code ?? null} />
                    </span>
                    <span className="text-xs font-medium text-[#2b0b2e]/70">From {who?.display_name ?? "someone"}</span>
                  </button>
                );
              })}
            </div>
            {postcards.length > 1 && <p className="mt-1 text-center text-xs text-muted">{postcards.length} postcards</p>}
          </section>
        )}

        {chat.friends.length > 0 && (
          <section aria-label="Friends" className="mb-5">
            <p className="eyebrow">Friends</p>
            <ul className="no-scrollbar -mx-5 mt-3 flex gap-3 overflow-x-auto px-5 pb-1">
              {chat.friends.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => startWith(me, chat, p)} className="flex w-16 flex-col items-center gap-1">
                    <Avatar p={p} size={52} ring />
                    <span className="w-full truncate text-center text-[11px]">{p.display_name.split(" ")[0]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {talks.length === 0 && postcards.length === 0 ? (
          <div className="mt-8 text-center">
            <p className="font-serif text-xl">Ask about a place.</p>
            <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
              Write to friends any time. To someone new, send a postcard about a place they&rsquo;ve been: they&rsquo;ll see it in their postcard stack.
            </p>
            <button type="button" onClick={() => goChat({ view: "new" })} className="btn-accent mt-5">
              Start a chat
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {talks.map((c) => {
              const who = chat.people[otherOf(c, me)];
              const m = chat.last[c.id];
              const unread = chat.unread.some((u) => u.id === c.id);
              const waiting = c.status === "postcard" && c.started_by === me;
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => goChat({ view: "conversation", conversationId: c.id })} className="flex w-full items-center gap-3 py-3 text-left">
                    {who && <Avatar p={who} size={48} />}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={cn("truncate", unread ? "font-semibold" : "font-medium")}>{who?.display_name ?? "Someone"}</span>
                        {m?.place_code && <span className="shrink-0 text-sm">{countryByCode(m.place_code)?.flag}</span>}
                      </span>
                      <span className={cn("block truncate text-sm", unread ? "text-ink" : "text-muted")}>
                        {waiting ? "Postcard sent · waiting for a reply" : `${m?.sender_id === me ? "You: " : ""}${m?.body ?? ""}`}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[11px] text-muted">{when(m?.created_at)}</span>
                      {unread && <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-label="Unread" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

/** Open the chat with someone: their conversation if there is one, otherwise a fresh draft. */
function startWith(me: string, chat: Chat, p: ChatPerson, place?: ChatPlace | null) {
  const existing = chat.conversations.find((c) => otherOf(c, me) === p.id);
  if (existing && !place) goChat({ view: "conversation", conversationId: existing.id });
  else goChat({ view: "draft", person: p, place: place ?? null });
}

function NewChat({ me, chat }: { me: string; chat: Chat }) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<ChatPerson[]>([]);
  useEffect(() => {
    const term = q.replace(/[%_,()*\\:.]/g, " ").trim();
    if (term.length < 2) {
      setFound([]);
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      const like = `%${term}%`;
      const { data } = await chat.supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .or(`display_name.ilike.${like},username.ilike.${like}`)
        .neq("id", me)
        .limit(12);
      if (alive) setFound((data ?? []) as ChatPerson[]);
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, chat.supabase, me]);

  const friendIds = new Set(chat.friends.map((f) => f.id));
  const list = q.trim().length >= 2 ? found : chat.friends;
  return (
    <>
      <Header title="New chat" onBack={() => goChat({ view: "home" })} />
      <div className="px-5">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" className="field !pl-10" aria-label="Search people" />
        </div>
      </div>
      <ul className="mt-3 flex-1 overflow-y-auto px-5 pb-8">
        {list.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => startWith(me, chat, p)} className="flex w-full items-center gap-3 py-2.5 text-left">
              <Avatar p={p} size={44} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{p.display_name}</span>
                <span className="block truncate text-xs text-muted">@{p.username}</span>
              </span>
              <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium", friendIds.has(p.id) ? "bg-accent-soft text-accent" : "bg-raised text-muted")}>
                {friendIds.has(p.id) ? "Friend" : "Postcard"}
              </span>
            </button>
          </li>
        ))}
        {q.trim().length >= 2 && found.length === 0 && <p className="py-6 text-center text-sm text-muted">Nobody by that name yet.</p>}
        {q.trim().length < 2 && chat.friends.length === 0 && (
          <p className="py-6 text-center text-sm text-muted">Search for anyone. Friends (you follow each other) chat freely; anyone else gets a postcard.</p>
        )}
      </ul>
    </>
  );
}

function Conversation({ me, chat, conversationId }: { me: string; chat: Chat; conversationId: string }) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const c = chat.conversations.find((x) => x.id === conversationId) ?? null;
  const person = c ? chat.people[otherOf(c, me)] : null;
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const { data } = await chat.supabase.from("messages").select("*").eq("conversation_id", conversationId).order("created_at").limit(300);
    setMessages((data ?? []) as MessageRow[]);
    setLoaded(true);
    void chat.supabase.rpc("mark_conversation_read", { p_conversation: conversationId });
  }, [chat.supabase, conversationId]);

  useEffect(() => {
    void load();
  }, [load]);
  // New messages, live.
  useEffect(() => {
    if (chat.incoming?.conversation_id === conversationId) void load();
  }, [chat.incoming, conversationId, load]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  if (!c || !person) {
    return (
      <>
        <Header title="Chat" onBack={() => goChat({ view: "home" })} />
        <p className="px-5 py-10 text-center text-sm text-muted">{loaded ? "This chat isn't here any more." : "Opening…"}</p>
      </>
    );
  }

  const incomingPostcard = isIncomingPostcard(c, me);
  const waiting = c.status === "postcard" && c.started_by === me;
  const declined = c.status === "declined" && c.started_by === me;
  const sub = incomingPostcard ? "Sent you a postcard" : waiting ? "Postcard sent · waiting for a reply" : c.status === "open" ? null : null;

  return (
    <>
      <Header person={person} sub={sub} onBack={() => goChat({ view: "home" })} menu={<SafetyMenu me={me} chat={chat} person={person} messages={messages} />} />
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {!chat.friends.some((f) => f.id === person.id) && <SafetyNote />}
        {messages.map((m, i) => (
          <Bubble key={m.id} m={m} mine={m.sender_id === me} postcard={i === 0 && c.started_by === m.sender_id && (incomingPostcard || waiting)} firstOfRun={messages[i - 1]?.sender_id !== m.sender_id} />
        ))}
        <div ref={endRef} />
      </div>
      {incomingPostcard ? (
        <PostcardAnswer
          name={person.display_name.split(" ")[0]}
          onDecline={async () => {
            await chat.supabase.rpc("decline_postcard", { p_conversation: c.id });
            await chat.reload();
            goChat({ view: "home" });
          }}
          composer={<Composer me={me} chat={chat} to={person} conversationId={c.id} onSent={load} placeholder="Write back to open the chat…" />}
        />
      ) : waiting || declined ? (
        <p className="border-t border-line px-5 py-4 text-center text-sm text-muted">
          {waiting ? `Your postcard is on its way. You can write again when ${person.display_name.split(" ")[0]} replies.` : "They’re not taking postcards right now."}
        </p>
      ) : (
        <Composer me={me} chat={chat} to={person} conversationId={c.id} onSent={load} />
      )}
    </>
  );
}

function Draft({ me, chat, person, place }: { me: string; chat: Chat; person: ChatPerson; place: ChatPlace | null }) {
  // Friends are people who follow each other: the list the chat already has.
  const friend = chat.friends.some((f) => f.id === person.id);
  const [draft, setDraft] = useState<{ text: string; place: ChatPlace | null }>({ text: "", place });
  const existing = chat.conversations.find((c) => otherOf(c, me) === person.id);

  return (
    <>
      <Header person={person} sub={friend ? "Friends" : "Not friends yet · this will be a postcard"} onBack={() => goChat({ view: "home" })} />
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 text-center">
        {!friend && (
          // The postcard as it will land in their stack, filling in as you write.
          <div className="postcard mb-6 w-full max-w-xs rotate-[-2deg] rounded-2xl p-4 text-left shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <p className={cn("min-h-[4.5rem] whitespace-pre-wrap font-serif text-[17px] leading-snug", draft.text ? "text-[#2b0b2e]" : "text-[#2b0b2e]/35")}>
                {draft.text || "Your words go here…"}
              </p>
              <Stamp code={draft.place?.code ?? null} />
            </div>
            <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#2b0b2e]/60">
              To {person.display_name.split(" ")[0]}
              {draft.place ? ` · ${countryByCode(draft.place.code)?.name ?? ""}` : ""}
            </p>
          </div>
        )}
        <Avatar p={person} size={friend ? 72 : 48} ring />
        <p className="mt-4 font-serif text-xl">
          {!friend ? `Send ${person.display_name.split(" ")[0]} a postcard` : `Say hi to ${person.display_name.split(" ")[0]}`}
        </p>
        <p className="mt-2 max-w-xs text-sm text-muted">
          {!friend
            ? "One message, stamped with the place it's about. If they write back, you can keep talking."
            : "Ask about a trip, a place, or just say hello."}
        </p>
        {!friend && (
          <div className="mt-4 w-full max-w-xs">
            <SafetyNote />
          </div>
        )}
        {existing && (
          <button type="button" onClick={() => goChat({ view: "conversation", conversationId: existing.id })} className="mt-4 text-sm font-medium text-accent hover:underline">
            Open your chat
          </button>
        )}
      </div>
      <Composer
        me={me}
        chat={chat}
        to={person}
        conversationId={existing?.id ?? null}
        initialPlace={place}
        placeholder={!friend ? "Write your postcard…" : "Message…"}
        postcard={!friend}
        onDraft={(text, p) => setDraft({ text, place: p })}
        onSent={async (id) => goChat({ view: "conversation", conversationId: id })}
      />
    </>
  );
}

// ---------------------------------------------------------------------------

function Composer({
  chat,
  to,
  initialPlace = null,
  placeholder = "Message…",
  onSent,
  onDraft,
  postcard = false,
}: {
  me: string;
  chat: Chat;
  to: ChatPerson;
  conversationId: string | null;
  initialPlace?: ChatPlace | null;
  placeholder?: string;
  onSent: (conversationId: string) => void | Promise<void>;
  /** What's being written, for a live preview. */
  onDraft?: (text: string, place: ChatPlace | null) => void;
  /** A first message to someone who isn't a friend: stricter rules (see chatRules). */
  postcard?: boolean;
}) {
  const [text, setText] = useState("");
  const [place, setPlace] = useState<ChatPlace | null>(initialPlace);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => onDraft?.(text, place), [text, place]); // eslint-disable-line react-hooks/exhaustive-deps

  // Said before sending, the same rules the server applies.
  const problem = text.trim() ? chatProblem(text, postcard) : null;

  async function send() {
    const body = text.trim();
    if (!body || busy || problem) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await chat.supabase.rpc("send_message", {
      p_to: to.id,
      p_body: body,
      p_place_code: place?.code ?? null,
      p_place_name: place?.name ?? null,
    });
    setBusy(false);
    if (err) {
      setError(err.message.replace(/^.*?: /, ""));
      return;
    }
    tapSuccess();
    setText("");
    setPlace(null);
    await chat.reload();
    await onSent(data as string);
  }

  return (
    <div className="border-t border-line bg-surface/80 px-3 pt-2 backdrop-blur" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}>
      {picking && <PlacePicker onPick={(p) => { setPlace(p); setPicking(false); }} onClose={() => setPicking(false)} />}
      {place && (
        <div className="mb-2 flex items-center gap-2 px-1">
          <Stamp code={place.code} small />
          <span className="text-sm">{place.name || countryByCode(place.code)?.name}</span>
          <button type="button" onClick={() => setPlace(null)} aria-label="Remove place" className="ml-auto text-muted hover:text-ink">
            <X size={16} />
          </button>
        </div>
      )}
      {(problem || error) && <p className="mb-2 px-1 text-xs text-red-700 dark:text-red-400">{problem ?? error}</p>}
      <div className="flex items-end gap-2">
        <button type="button" onClick={() => setPicking((v) => !v)} aria-label="Stamp a place" className={cn("mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full", place ? "bg-accent-soft text-accent" : "text-muted hover:bg-raised")}>
          <MapPin size={20} />
        </button>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            // Grow with the text, up to a few lines.
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder={placeholder}
          aria-label="Message"
          className="max-h-32 min-h-[42px] flex-1 resize-none rounded-[22px] border border-line bg-canvas px-4 py-2.5 text-[15px] outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={!text.trim() || busy || !!problem}
          aria-label="Send"
          className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-opacity disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #fa51a2, #fb7822)" }}
        >
          <ArrowUp size={20} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

/** The rules, said kindly, wherever people aren't friends yet. */
function SafetyNote() {
  return (
    <p className="mb-3 flex items-start gap-2 rounded-2xl bg-raised px-3 py-2.5 text-left text-xs leading-relaxed text-muted">
      <ShieldCheck size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden />
      <span>
        Keep it about places and trips. Selling, links and contact details aren&rsquo;t allowed in postcards, and ExpandiaX never asks for money in
        chat. Something off? Report it from &hellip; above.
      </span>
    </p>
  );
}

const REPORT_REASONS = ["Selling or spam", "A scam or asking for money", "Harassment or something hurtful", "Something else"];

/** ... in a conversation: report what they sent, or block them. */
function SafetyMenu({ me, chat, person, messages }: { me: string; chat: Chat; person: ChatPerson; messages: MessageRow[] }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"menu" | "report" | "reported" | "block">("menu");
  const [busy, setBusy] = useState(false);
  const theirs = [...messages].reverse().find((m) => m.sender_id !== me);

  async function report(reason: string) {
    setBusy(true);
    await chat.supabase.from("reports").insert(
      theirs
        ? { reporter_id: me, target_type: "message", target_id: theirs.id, target_url: `/u/${person.username}`, reason: `${reason}: "${theirs.body.slice(0, 300)}"` }
        : { reporter_id: me, target_type: "profile", target_id: person.id, target_url: `/u/${person.username}`, reason }
    );
    setBusy(false);
    setStep("reported");
  }

  async function block() {
    setBusy(true);
    await chat.supabase.rpc("block_user", { p_blocked_id: person.id });
    setBusy(false);
    setOpen(false);
    await chat.reload();
    goChat({ view: "home" });
  }

  const first = person.display_name.split(" ")[0];
  return (
    <>
      <button type="button" onClick={() => { setStep("menu"); setOpen(true); }} aria-label="Report or block" className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-raised">
        <MoreHorizontal size={20} />
      </button>
      {open && (
        <div className="absolute inset-0 z-20 flex items-end bg-black/30" onClick={() => setOpen(false)}>
          <div className="w-full rounded-t-3xl bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}>
            {step === "menu" && (
              <div className="space-y-2">
                <button type="button" onClick={() => setStep("report")} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-raised">
                  <Flag size={18} className="text-red-700 dark:text-red-400" /> <span className="font-medium">Report {first}</span>
                </button>
                <button type="button" onClick={() => setStep("block")} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-raised">
                  <Ban size={18} className="text-red-700 dark:text-red-400" /> <span className="font-medium">Block {first}</span>
                </button>
                <button type="button" onClick={() => setOpen(false)} className="w-full py-2 text-sm text-muted">Cancel</button>
              </div>
            )}
            {step === "report" && (
              <div>
                <p className="font-serif text-xl">What&rsquo;s wrong?</p>
                <p className="mt-1 text-sm text-muted">We&rsquo;ll look at {theirs ? "their last message" : "their account"}. {first} won&rsquo;t know it was you.</p>
                <div className="mt-4 space-y-2">
                  {REPORT_REASONS.map((r) => (
                    <button key={r} type="button" disabled={busy} onClick={() => void report(r)} className="w-full rounded-2xl border border-line px-4 py-3 text-left text-sm hover:border-accent">
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {step === "reported" && (
              <div>
                <p className="font-serif text-xl">Thanks for telling us.</p>
                <p className="mt-1 text-sm text-muted">We&rsquo;ll take a look. You can also block {first} so they can&rsquo;t write to you again.</p>
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={() => void block()} disabled={busy} className="btn-accent flex-1 justify-center">Block {first}</button>
                  <button type="button" onClick={() => setOpen(false)} className="btn-ghost flex-1 justify-center">Done</button>
                </div>
              </div>
            )}
            {step === "block" && (
              <div>
                <p className="font-serif text-xl">Block {first}?</p>
                <p className="mt-1 text-sm text-muted">They won&rsquo;t be able to write to you, see your profile or find you. They aren&rsquo;t told.</p>
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={() => void block()} disabled={busy} className="flex-1 rounded-full bg-red-700 px-4 py-3 font-semibold text-white">Block</button>
                  <button type="button" onClick={() => setOpen(false)} className="btn-ghost flex-1 justify-center">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function PlacePicker({ onPick, onClose }: { onPick: (p: ChatPlace) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (t ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(t)) : COUNTRIES).slice(0, 30);
  }, [q]);
  return (
    <div className="mb-2 rounded-2xl border border-line bg-canvas p-2">
      <div className="flex items-center gap-2">
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Which place is it about?" className="field !py-2 text-sm" aria-label="Search places" />
        <button type="button" onClick={onClose} aria-label="Close" className="text-muted">
          <X size={18} />
        </button>
      </div>
      <ul className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
        {list.map((c) => (
          <li key={c.code}>
            <button type="button" onClick={() => onPick({ code: c.code })} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-line px-3 py-1.5 text-sm hover:border-accent">
              {c.flag} {c.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PostcardAnswer({ name, onDecline, composer }: { name: string; onDecline: () => void; composer: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-2.5 text-xs text-muted">
        <span>Write back to {name} and you can keep talking.</span>
        <button type="button" onClick={onDecline} className="shrink-0 font-medium text-ink hover:underline">
          Not now
        </button>
      </div>
      {composer}
    </div>
  );
}

function Bubble({ m, mine, postcard, firstOfRun }: { m: MessageRow; mine: boolean; postcard: boolean; firstOfRun: boolean }) {
  const place = m.place_code ? countryByCode(m.place_code) : null;
  if (postcard) {
    return (
      <div className={cn("my-3 flex", mine ? "justify-end" : "justify-start")}>
        <div className="postcard w-[85%] rotate-[-1.5deg] rounded-2xl p-4 shadow-md">
          <div className="flex items-start justify-between gap-3">
            <p className="whitespace-pre-wrap font-serif text-[17px] leading-snug text-[#2b0b2e]">{m.body}</p>
            <Stamp code={m.place_code} />
          </div>
          <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#2b0b2e]/60">Postcard{place ? ` · ${m.place_name || place.name}` : ""}</p>
        </div>
      </div>
    );
  }
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start", firstOfRun ? "mt-3" : "mt-1")}>
      <div className={cn("max-w-[80%] rounded-[20px] px-3.5 py-2 text-[15px] leading-snug", mine ? "rounded-br-md text-white" : "rounded-bl-md bg-surface ring-1 ring-line")} style={mine ? { background: "linear-gradient(135deg, #fa51a2, #fb7822)" } : undefined}>
        {place && (
          <Link
            href={`/explore/country/${place.code.toLowerCase()}`}
            onClick={closeChat}
            className={cn("mb-1.5 flex items-center gap-1.5 rounded-xl px-2 py-1 text-xs font-medium", mine ? "bg-white/20" : "bg-raised")}
          >
            <span className="text-base leading-none">{place.flag}</span> {m.place_name || place.name}
          </Link>
        )}
        <p className="whitespace-pre-wrap break-words">{m.body}</p>
      </div>
    </div>
  );
}

function Stamp({ code, small = false }: { code: string | null; small?: boolean }) {
  const c = code ? countryByCode(code) : null;
  return (
    <span className={cn("stamp flex shrink-0 flex-col items-center justify-center bg-white text-center", small ? "h-10 w-9" : "h-14 w-12")} aria-hidden>
      <span className={small ? "text-lg" : "text-2xl"}>{c?.flag ?? "✈️"}</span>
      {!small && <span className="mt-0.5 max-w-full truncate px-0.5 text-[7px] font-bold uppercase tracking-wider text-[#2b0b2e]">{c?.code ?? "Air"}</span>}
    </span>
  );
}

function Header({ title, person, sub, onBack, menu }: { title?: string; person?: ChatPerson; sub?: string | null; onBack: () => void; menu?: React.ReactNode }) {
  return (
    <header className="flex items-center gap-2 border-b border-line px-3 py-3">
      <button type="button" onClick={onBack} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-raised">
        <ArrowLeft size={20} />
      </button>
      {person ? (
        <Link href={`/u/${person.username}`} onClick={closeChat} className="flex min-w-0 flex-1 items-center gap-2.5">
          <Avatar p={person} size={36} />
          <span className="min-w-0">
            <span className="block truncate font-medium leading-tight">{person.display_name}</span>
            {sub && <span className="block truncate text-xs text-muted">{sub}</span>}
          </span>
        </Link>
      ) : (
        <h2 className="flex-1 font-serif text-xl">{title}</h2>
      )}
      {menu}
      <button type="button" onClick={closeChat} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-raised">
        <X size={20} />
      </button>
    </header>
  );
}

function Avatar({ p, size, ring = false }: { p: ChatPerson; size: number; ring?: boolean }) {
  return (
    <span
      className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-raised font-serif text-muted", ring && "ring-2 ring-accent ring-offset-2 ring-offset-canvas")}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {p.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
      ) : (
        p.display_name.charAt(0)
      )}
    </span>
  );
}

function when(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (days < 7) return d.toLocaleDateString("en-GB", { weekday: "short" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const STYLES = `
.chat-ping { box-shadow: 0 0 0 0 rgba(250,81,162,.6); animation: chat-ping 1.8s ease-out infinite; }
@keyframes chat-ping { 70% { box-shadow: 0 0 0 14px rgba(250,81,162,0); } 100% { box-shadow: 0 0 0 0 rgba(250,81,162,0); } }
.chat-sheet { animation: chat-up .32s cubic-bezier(.2,.9,.3,1) both; }
@keyframes chat-up { from { transform: translateY(40px); opacity: 0; } }
.postcard { background: linear-gradient(135deg, #fff8ee, #ffe9d6); border: 1px solid rgba(43,11,46,.08); }
.stamp { border-radius: 2px; box-shadow: 0 1px 3px rgba(0,0,0,.18); outline: 1.5px dashed rgba(43,11,46,.28); outline-offset: -4px; transform: rotate(3deg); }
@media (prefers-reduced-motion: reduce) { .chat-ping, .chat-sheet { animation: none; } }
`;
