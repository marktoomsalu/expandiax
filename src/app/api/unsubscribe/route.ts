import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMAIL_LISTS, escapeHtml, isEmailList, verifyUnsubscribeToken, type EmailList } from "@/lib/unsubscribe";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Which email the link is for: `l=follows`, or the weekly digest when there's no `l` (older links). */
function listOf(request: NextRequest): EmailList | null {
  const l = request.nextUrl.searchParams.get("l");
  if (l === null) return "digest";
  return isEmailList(l) ? l : null;
}

async function turnOff(request: NextRequest): Promise<{ ok: boolean; list: EmailList }> {
  const list = listOf(request);
  const userId = request.nextUrl.searchParams.get("u");
  const token = request.nextUrl.searchParams.get("t");
  if (!list || !userId || !token || !UUID.test(userId) || !verifyUnsubscribeToken(userId, token, list)) return { ok: false, list: list ?? "digest" };
  const { error } = await createAdminClient()
    .from("profiles")
    .update({ [EMAIL_LISTS[list].column]: false })
    .eq("id", userId);
  return { ok: !error, list };
}

const page = (title: string, body: string, status: number) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="font-family:-apple-system,system-ui,sans-serif;max-width:460px;margin:15vh auto;padding:0 20px;color:#17171b;line-height:1.6">
<h1 style="font-size:22px;font-weight:600">${escapeHtml(title)}</h1><p style="font-size:15px">${body}</p>
<p style="font-size:14px"><a href="https://expandiax.com/settings" style="color:#e91e63">Email settings</a></p></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
  );

// The link inside the email.
export async function GET(request: NextRequest) {
  const { ok, list } = await turnOff(request);
  const name = EMAIL_LISTS[list].name;
  return ok
    ? page("You're unsubscribed", `You won't get ${name} any more. You can switch this back on any time in Settings.`, 200)
    : page("That link didn't work", `It may be incomplete or out of date. You can turn off ${name} yourself in Settings.`, 400);
}

// RFC 8058 one-click unsubscribe: mail apps (Gmail, Apple Mail) POST here
// straight from their own "Unsubscribe" button.
export async function POST(request: NextRequest) {
  const { ok } = await turnOff(request);
  return new Response(null, { status: ok ? 200 : 400 });
}
