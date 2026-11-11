import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { AppStoreBadge } from "@/components/AppStoreBadge";
import { FollowButton } from "@/components/FollowButton";
import { RememberInvite } from "@/components/invite/RememberInvite";
import type { ProfileVisibility } from "@/lib/types";
import { APP_STORE_URL } from "@/lib/appStore";
import { isNativeUserAgent } from "@/lib/nativeApp";
import { noteInviteClick } from "@/lib/inviteClicks";

// Link previews (iMessage, WhatsApp…) fetch the page with these: they get the page, not a redirect.
const PREVIEW_BOT = /bot|crawl|spider|facebookexternalhit|facebot|whatsapp|telegram|slack|discord|skype|linkedin|pinterest|embedly|preview|vkshare|quora/i;

type Props = { params: { username: string } };

async function inviterOf(username: string) {
  const { data } = await createClient()
    .from("profiles")
    .select("id, username, display_name, avatar_url, home_country_code, visibility")
    .eq("username", decodeURIComponent(username).toLowerCase())
    .maybeSingle();
  return data as { id: string; username: string; display_name: string; avatar_url: string | null; home_country_code: string | null; visibility: ProfileVisibility } | null;
}

export async function generateMetadata({ params }: Props) {
  const p = await inviterOf(params.username);
  const first = (p?.display_name ?? "A friend").trim().split(" ")[0];
  const title = `${first} invited you to ExpandiaX`;
  const description = "Join me: the places you've been and the moments you never want to forget, on one map.";
  // A small ExpandiaX icon in the preview (not anyone's photo): it reads as
  // the app's own invitation, which is what makes people trust it.
  const icon = { url: "https://expandiax.com/invite-preview.png", width: 300, height: 300, alt: "ExpandiaX" };
  return {
    title: { absolute: title },
    description,
    openGraph: { title, description, siteName: "ExpandiaX", type: "website", images: [icon] },
    twitter: { card: "summary", title, description, images: [icon.url] },
  };
}

/** expandiax.com/join/<username>: a friend's invitation. Remembers who invited you, for after you sign up. */
export default async function JoinPage({ params }: Props) {
  const inviter = await inviterOf(params.username);
  if (!inviter) notFound();
  const user = await getAuthUser();
  // On an iPhone, without the app (the app opens these links itself) and
  // not signed in on the website: straight to the App Store, remembering
  // the invite for after the install.
  const h = headers();
  const ua = h.get("user-agent") ?? "";
  if (!user && /iPhone|iPad|iPod/.test(ua) && !isNativeUserAgent(ua) && !PREVIEW_BOT.test(ua)) {
    await noteInviteClick(inviter.id, h).catch(() => {});
    redirect(APP_STORE_URL);
  }
  const { data: count } = await createClient().from("public_country_counts").select("country_count").eq("user_id", inviter.id).maybeSingle();
  const countries = Number(count?.country_count ?? 0);
  const first = inviter.display_name.trim().split(" ")[0];
  const home = countryByCode(inviter.home_country_code);

  return (
    <div className="relative min-h-[80vh] overflow-hidden">
      <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(120% 70% at 50% 0%, #4a1450 0%, #2b0b2e 50%, #12041a 100%)" }} />
      <div aria-hidden className="join-stars absolute inset-0 opacity-60" />
      <div className="relative mx-auto flex max-w-md flex-col items-center px-6 pb-16 pt-14 text-center text-white">
        {!user && <RememberInvite username={inviter.username} />}
        <span className="join-halo relative flex h-32 w-32 items-center justify-center rounded-full p-1" style={{ background: "conic-gradient(from 200deg, #fa51a2, #fb7822, #fa51a2)" }}>
          <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#2b0b2e] font-serif text-5xl">
            {inviter.avatar_url ? <Image src={inviter.avatar_url} alt="" fill sizes="128px" className="object-cover" priority /> : first.charAt(0)}
          </span>
        </span>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-white/55">You&rsquo;re invited</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight">
          {first} invited you
          <br />
          <span className="italic text-[#fa8fc4]">to ExpandiaX</span>
        </h1>
        <p className="mt-4 max-w-xs text-white/75">
          The places you&rsquo;ve been and the moments you never want to forget, on one map. Join, and you and {first} follow each other straight away.
        </p>
        {(countries > 0 || home) && (
          <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm ring-1 ring-white/15">
            {home && <span aria-hidden>{home.flag}</span>}
            {countries > 0 ? `${first} has been to ${countries} ${countries === 1 ? "country" : "countries"}` : `${first} is from ${home?.name}`}
          </p>
        )}

        {!user ? (
          <div className="mt-8 flex w-full flex-col items-center gap-4">
            <Link href="/start" className="w-full rounded-full py-4 text-lg font-bold text-[#2b0b2e]" style={{ background: "linear-gradient(90deg, #fa51a2, #fb7822)" }}>
              Join {first}
            </Link>
            <AppStoreBadge height={44} />
            <p className="text-xs text-white/50">
              Already a member?{" "}
              <Link href="/sign-in" className="underline">
                Sign in
              </Link>
            </p>
          </div>
        ) : user.id === inviter.id ? (
          <div className="mt-8 w-full">
            <p className="text-sm text-white/70">This is your invite link. Friends who join through it follow you straight away.</p>
            <Link href="/invite" className="mt-4 inline-block rounded-full bg-white px-6 py-3 font-semibold text-[#2b0b2e]">
              Invite friends
            </Link>
          </div>
        ) : (
          <div className="mt-8 flex w-full flex-col items-center gap-3">
            <p className="text-sm text-white/70">You&rsquo;re already on ExpandiaX.</p>
            <FollowButton targetId={inviter.id} visibility={inviter.visibility} initialFollowing={false} />
            <Link href={`/u/${inviter.username}`} className="text-sm text-white/70 underline">
              See {first}&rsquo;s world
            </Link>
          </div>
        )}
      </div>
      <style>{`.join-stars{background-image:radial-gradient(1px 1px at 20% 30%,#fff,transparent),radial-gradient(1px 1px at 70% 20%,#fff,transparent),radial-gradient(1.5px 1.5px at 40% 70%,#fff,transparent),radial-gradient(1px 1px at 85% 60%,#fff,transparent),radial-gradient(1px 1px at 10% 85%,#fff,transparent)}.join-halo{box-shadow:0 0 60px rgba(250,81,162,.45)}`}</style>
    </div>
  );
}
