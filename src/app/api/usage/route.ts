import { NextRequest, NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Item = { kind?: string; key?: string; amount?: number };

/** Adds to the anonymous usage totals (migration 086). Signed-in members only; nothing about them is kept. */
export async function POST(request: NextRequest) {
  if (!(await getAuthUser())) return new NextResponse(null, { status: 204 });
  const body = (await request.json().catch(() => ({}))) as { items?: Item[] };
  const items = (body.items ?? []).slice(0, 40).filter((i) => (i.kind === "page" || i.kind === "feature" || i.kind === "visit") && typeof i.key === "string" && /^[a-z0-9_]{1,40}$/.test(i.key));
  // The same counter several times in one batch: added up first, one call each.
  const sums = new Map<string, { kind: string; key: string; amount: number }>();
  for (const i of items) {
    const k = `${i.kind}:${i.key}`;
    const amount = Math.max(1, Math.min(3600, Math.round(i.amount ?? 1)));
    const cur = sums.get(k);
    sums.set(k, { kind: i.kind!, key: i.key!, amount: (cur?.amount ?? 0) + amount });
  }
  const supabase = createClient();
  await Promise.all(
    [...sums.values()].flatMap(({ kind, key, amount }) => {
      // Seconds go in pieces of up to an hour (the database's cap per call); counts one call per use.
      const parts = kind === "visit" && key === "seconds" ? [amount] : Array.from({ length: Math.min(amount, 20) }, () => 1);
      return parts.map((n) => supabase.rpc("note_usage", { p_kind: kind, p_key: key, p_amount: n }).then(() => null, () => null));
    })
  );
  return new NextResponse(null, { status: 204 });
}
