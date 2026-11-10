// The chat bubble's state, so anything in the app can open it: the bubble
// itself, "Ask Mark about Italy" on a country page, or a tapped push.

export type ChatPerson = { id: string; username: string; display_name: string; avatar_url: string | null };
export type ChatPlace = { code: string; name?: string | null };

export type ChatTarget =
  | { view: "home" }
  | { view: "conversation"; conversationId: string }
  | { view: "draft"; person: ChatPerson; place?: ChatPlace | null }
  | { view: "new" };

type State = { open: boolean; target: ChatTarget };

let state: State = { open: false, target: { view: "home" } };
const listeners = new Set<() => void>();

function set(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

export const chatSubscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const chatState = () => state;
export const chatServerState = (): State => ({ open: false, target: { view: "home" } });

export function openChat(target: ChatTarget = { view: "home" }) {
  set({ open: true, target });
}
export function closeChat() {
  set({ ...state, open: false });
}
export function goChat(target: ChatTarget) {
  set({ ...state, target });
}

/** A conversation as the list shows it. */
export type ConversationRow = {
  id: string;
  a: string;
  b: string;
  status: "open" | "postcard" | "declined";
  started_by: string;
  last_message_at: string;
  a_read_at: string;
  b_read_at: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  place_code: string | null;
  place_name: string | null;
  created_at: string;
};

export const otherOf = (c: ConversationRow, me: string) => (c.a === me ? c.b : c.a);
export const myReadAt = (c: ConversationRow, me: string) => (c.a === me ? c.a_read_at : c.b_read_at);

/** A postcard someone sent you that you haven't answered yet. */
export const isIncomingPostcard = (c: ConversationRow, me: string) => c.status === "postcard" && c.started_by !== me;
