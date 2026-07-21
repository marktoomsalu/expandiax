import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FollowList } from "@/components/FollowList";

export const metadata = { title: "Followers" };

export default async function FollowersPage({ params }: { params: { username: string } }) {
  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .eq("username", params.username.toLowerCase())
    .maybeSingle();

  if (!profile) {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <h1 className="text-3xl">This world is private.</h1>
        <p className="mt-3 text-sm text-muted">The profile doesn&rsquo;t exist, or its owner keeps it to themselves.</p>
        <Link href="/explore" className="btn-ghost mt-8">Explore public travellers</Link>
      </div>
    );
  }

  const { data } = await supabase
    .from("follows")
    .select("follower:profiles!follows_follower_id_fkey(id, username, display_name, avatar_url)")
    .eq("followee_id", profile.id)
    .order("created_at", { ascending: false });

  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
  const followers = (data ?? []).map((r) => one(r.follower)).filter((p): p is NonNullable<typeof p> => !!p);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Link href={`/u/${profile.username}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> {profile.display_name}
      </Link>
      <p className="eyebrow mt-8">{profile.display_name}</p>
      <h1 className="mt-1 text-3xl md:text-4xl">Followers</h1>
      <FollowList profiles={followers} emptyMessage={`${profile.display_name} doesn't have any followers yet.`} />
    </div>
  );
}
