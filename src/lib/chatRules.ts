// What a chat message may not say. The database enforces this in
// send_message() (migration 065, private.chat_problem) with the same
// patterns; this copy lets the app warn before sending and is what the
// tests check. Keep the two in step.

export const SCAM =
  /\b(crypto|bitcoin|btc|usdt|forex|binary options?|investment opportunit\w*|invest with me|double your money|guaranteed (return|profit)s?|gift ?cards?|wire transfer|western union|moneygram|sugar ?(daddy|baby)|escorts?|onlyfans|casino|betting tips|loan offers?|recover(y)? (your )?funds)\b/i;
export const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|shop|store|biz|info|me|ly|link|app|site|online)\b)/i;
export const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
export const ELSEWHERE = /\b(whats ?app|telegram|signal me|snapchat|snap me|kik|wechat|dm me|text me|call me|add me on|follow me on|my insta)\b/i;
export const SELLING =
  /(\bfor sale\b|\bon sale\b|\bbuy now\b|\bbuy from me\b|\bsell(ing)?\b|\bdiscounts?\b|\bpromo(tion)?s?\b|\bcoupons?\b|\border now\b|\bshop now\b|% off\b|\bspecial offers?\b|\bhire me\b|\bmy services\b|\bbusiness opportunit\w*|\bbest prices?\b|\bcheap (flights|tickets|hotels|rooms)\b)/i;
const PHONE_SPAN = /[+0-9][0-9 ().-]{6,}[0-9]/g;
const YEARS = /^(19|20)\d\d\D+(19|20)\d\d$/;

export function hasPhone(text: string): boolean {
  for (const m of text.match(PHONE_SPAN) ?? []) {
    if (m.replace(/\D/g, "").length >= 8 && !YEARS.test(m.trim())) return true;
  }
  return false;
}

/** Why this can't be sent, or null. `firstContact`: a postcard to someone who isn't a friend. */
export function chatProblem(text: string, firstContact: boolean): string | null {
  if (SCAM.test(text)) return "This looks like spam or a scam, so it wasn't sent.";
  if (!firstContact) return null;
  if (LINK.test(text)) return "Postcards can't include links. Once they write back, you can share more.";
  if (EMAIL.test(text)) return "Postcards can't include email addresses.";
  if (hasPhone(text)) return "Postcards can't include phone numbers.";
  if (ELSEWHERE.test(text)) return "Postcards are for talking here, not moving the chat elsewhere.";
  if (SELLING.test(text)) return "Postcards are for talking about places, not selling. Write about the trip instead.";
  return null;
}
