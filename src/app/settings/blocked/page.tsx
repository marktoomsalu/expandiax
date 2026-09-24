import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { UnblockButton } from "@/components/UnblockButton";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Blocked accounts" };

type BlockedProfile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  blocked_at: string;
};

export default async function BlockedAccountsPage() {
  const supabase = createClient();
  const user = await getAuthUser();
  if (!user) redirect("/sign-in");

  // Blocked profiles are hidden from you everywhere else, so this database
  // function is the one place their names come back — and only your own.
  const { data } = await supabase.rpc("my_blocked_profiles");
  const blocked = (data ?? []) as BlockedProfile[];

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Settings
      </Link>

      <p className="eyebrow mt-6">Settings</p>
      <h1 className="mt-2 text-3xl md:text-4xl">Blocked accounts</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Blocking hides you and them from each other - profiles, trips, events, likes and comments - and ends any follows
        between you. They aren&rsquo;t told, nothing happens to their account, and you can undo it any time. To follow
        each other again after unblocking, you&rsquo;ll each need to follow again.
      </p>

      {blocked.length === 0 ? (
        <p className="mt-8 rounded-lg border border-line bg-surface px-4 py-6 text-center text-sm text-muted">
          You haven&rsquo;t blocked anyone.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-line rounded-lg border border-line bg-surface">
          {blocked.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-raised font-serif text-sm text-muted">
                {p.avatar_url ? (
                  <Image src={p.avatar_url} alt="" width={40} height={40} className="h-full w-full object-cover" />
                ) : (
                  p.display_name.charAt(0)
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.display_name}</p>
                <p className="truncate text-xs text-muted">
                  @{p.username} · blocked {formatDate(p.blocked_at)}
                </p>
              </div>
              <UnblockButton blockedId={p.id} name={p.display_name} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
