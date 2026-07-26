import { Resend } from "resend";

let resend: Resend | null = null;

export function getResend(): Resend {
  if (resend) return resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("not_configured");
  resend = new Resend(key);
  return resend;
}
