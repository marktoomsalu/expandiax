import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { adminId } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PartnersAdmin, type AdminPlacement } from "@/components/admin/PartnersAdmin";

export const metadata = { title: "Partners" };
export const dynamic = "force-dynamic";

/** Partner placements: add events and country cards, schedule and end them, see how they do. Admins only. */
export default async function AdminPartnersPage() {
  if (!(await adminId())) notFound();
  const { data, error } = await createAdminClient().from("partner_placements").select("*").order("created_at", { ascending: false });
  const rows = (data ?? []) as AdminPlacement[];
  const views = rows.reduce((n, r) => n + r.views, 0);
  const clicks = rows.reduce((n, r) => n + r.clicks, 0);

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Dashboard
      </Link>
      <h1 className="mt-4 text-3xl md:text-4xl">Partners</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        A partner&rsquo;s <span className="font-medium text-ink">event</span> is featured on Explore for people who live in or dream of its countries.
        A <span className="font-medium text-ink">country card</span> sits on that country&rsquo;s page. Both are labelled as partners, one per screen at most.
      </p>

      {error ? (
        <p className="mt-6 rounded-xl border border-line bg-surface px-4 py-3 text-sm">Run migration 084 first, then this page fills in.</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <Tile label="Placements" value={rows.length} />
            <Tile label="Views" value={views} />
            <Tile label="Clicks" value={clicks} sub={views ? `${((clicks / views) * 100).toFixed(1)}% of views` : undefined} />
          </div>
          <PartnersAdmin rows={rows} />
        </>
      )}
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-serif text-3xl">{value.toLocaleString("en")}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}
