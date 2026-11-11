import { NextRequest, NextResponse } from "next/server";
import { adminId } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Change the words of an automatic notification, or switch it on or off. Admins only. */
export async function PUT(request: NextRequest) {
  const me = await adminId();
  if (!me) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const body = (await request.json()) as { kind?: string; title?: string; body?: string; enabled?: boolean };
  const title = (body.title ?? "").trim();
  const text = (body.body ?? "").trim();
  if (!body.kind || !title || title.length > 80 || !text || text.length > 300) return NextResponse.json({ error: "Write a title (up to 80 characters) and a message (up to 300)." }, { status: 400 });
  const { error } = await createAdminClient()
    .from("push_templates")
    .update({ title, body: text, enabled: body.enabled !== false, updated_at: new Date().toISOString(), updated_by: me })
    .eq("kind", body.kind);
  return error ? NextResponse.json({ error: "Couldn't save it." }, { status: 500 }) : NextResponse.json({ ok: true });
}
