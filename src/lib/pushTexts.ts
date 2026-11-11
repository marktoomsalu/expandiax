// The words of every automatic notification, as the app ships them. The
// admin panel can change each one (push_templates, migrations 067-068);
// these are used whenever a row is missing.
//   {name}   who did it          {others}  "1 other" / "4 others"
//   {count}  how many            {text}    their comment, question or message
//   {place}  the country         {thing}   "trip" or "event"
//   {title}  a trip or event     {flag} {ago} {year}  for memory reminders

export const DEFAULT_TEXTS: Record<string, { title: string; body: string }> = {
  message: { title: "New message", body: "{name} sent you a message." },
  message_many: { title: "New messages", body: "{name} sent you {count} messages." },
  postcard: { title: "A postcard for you", body: '{name}: "{text}"' },
  follow: { title: "New follower", body: "{name} started following you!" },
  follow_many: { title: "New followers", body: "{name} and {others} started following you!" },
  follow_request: { title: "Follow request", body: "{name} wants to follow you" },
  follow_request_many: { title: "Follow requests", body: "{name} and {others} want to follow you" },
  follow_accepted: { title: "Follow request accepted", body: "{name} accepted your follow request" },
  comment: { title: "New comment", body: "{name} commented on your memory" },
  comment_many: { title: "New comments", body: "{count} people commented on your memory" },
  question: { title: "A question for you", body: '{name} asks about {place}: "{text}"' },
  answer: { title: "New answer", body: '{name} answered: "{text}"' },
  answer_many: { title: "New answers", body: "{count} people answered your question" },
  like: { title: "New like", body: "{name} liked your memory ❤️" },
  like_many: { title: "New likes", body: "{name} and {others} liked your memory ❤️" },
  reminder_anniversary: { title: "{ago} today", body: "{title} {flag}. Take a moment to look back." },
  reminder_photos: { title: "Your {title} memories", body: "No photos from {title} yet. Add a few so it's never forgotten." },
  reminder_memory: { title: "One to remember", body: "{title} {flag}, {ago}. Take a look back ✨" },
};

/** The notification several of the same kind collect into. */
export const MANY: Record<string, string> = {
  message: "message_many",
  postcard: "message_many",
  follow: "follow_many",
  follow_request: "follow_request_many",
  comment: "comment_many",
  answer: "answer_many",
  like: "like_many",
};

/** {name}, {text}… filled in; unknown ones left empty. */
export function fillTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? "").replace(/\s+/g, " ").replace(/\s+([.,!?])/g, "$1").trim();
}
