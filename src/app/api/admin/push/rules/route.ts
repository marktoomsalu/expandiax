import { NextRequest, NextResponse } from "next/server";
import { adminId } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { mergeRules } from "@/lib/pushPolicy";

export const dynamic = "force-dynamic";

/** Change the push rules (quiet hours, grouping, reminders, limits). Admins only; out-of-range numbers are brought into range. */
export async function PUT(request: NextRequest) {
  const me = await adminId();
  if (!me) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const rules = mergeRules(await request.json().catch(() => null));
  const { error } = await createAdminClient()
    .from("push_rules")
    .upsert({ id: true, rules, updated_at: new Date().toISOString(), updated_by: me });
  return error ? NextResponse.json({ error: "Couldn't save them." }, { status: 500 }) : NextResponse.json({ ok: true, rules });
}
