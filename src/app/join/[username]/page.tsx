import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { AppStoreBadge } from "@/components/AppStoreBadge";
import { FollowButton } from "@/components/FollowButton";
import { RememberInvite } from "@/components/invite/RememberInvite";
import { Camera, Globe2, Lock, Ticket } from "lucide-react";
import type { ProfileVisibility } from "@/lib/types";
import { APP_STORE_URL } from "@/lib/appStore";
import { isNativeUserAgent } from "@/lib/nativeApp";
import { noteInviteClick } from "@/lib/inviteClicks";

// Link previews (iMessage, WhatsApp…) fetch the page with these: they get the page, not a redirect.
const PREVIEW_BOT = /bot|crawl|spider|facebookexternalhit|facebot|whatsapp|telegram|slack|discord|skype|linkedin|pinterest|embedly|preview|vkshare|quora/i;
// Apps' own built-in browsers (Messenger, Instagram, Facebook, TikTok…) can't
// follow an automatic jump to the App Store (the page stays blank); there the
// invite page shows, and tapping its App Store button works.
const IN_APP_BROWSER = /FBAN|FBAV|FBIOS|FB_IAB|FBSV|Messenger|Instagram|Snapchat|TikTok|musical_ly|BytedanceWebview|LinkedInApp|Twitter|Line\/|GSA\/|Pinterest|WhatsApp/i;

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
  const description = "Your travels and memories, remembered.";
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
  const iphone = !user && /iPhone|iPad|iPod/.test(ua) && !isNativeUserAgent(ua) && !PREVIEW_BOT.test(ua);
  if (iphone) {
    await noteInviteClick(inviter.id, h).catch(() => {});
    if (!IN_APP_BROWSER.test(ua)) redirect(APP_STORE_URL);
  }
  const first = inviter.display_name.trim().split(" ")[0];

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
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-white/55">Let&rsquo;s collect memories together</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight">
          {first} invited you
          <br />
          <span className="italic text-[#fa8fc4]">to ExpandiaX</span>
        </h1>
        <p className="mt-4 max-w-xs text-white/75">
          The places you&rsquo;ve been and the moments you never want to forget, all in one place. Join and you&rsquo;ll automatically follow each other, so you can start sharing memories right away.
        </p>

        {/* What's waiting on the other side: a little curiosity, no spoilers. */}
        <div className="mt-6 w-full rounded-2xl bg-white/[0.07] p-4 text-left ring-1 ring-white/15 backdrop-blur">
          <p className="text-sm font-semibold">
            Join {first} on ExpandiaX and discover
          </p>
          <ul className="mt-3 space-y-2.5">
            {[
              { icon: Globe2, text: `How many countries ${first} has explored` },
              { icon: Ticket, text: `The events ${first} loved most` },
              { icon: Camera, text: `The memories ${first} has shared` },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-white/85">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#fa51a2] to-[#fb7822] text-white" aria-hidden>
                  <Icon size={15} />
                </span>
                <span className="flex-1">{text}</span>
                <Lock size={13} className="shrink-0 text-white/40" aria-label="After you join" />
              </li>
            ))}
          </ul>
        </div>

        {!user ? (
          <div className="mt-8 flex w-full flex-col items-center gap-4">
            {iphone ? (
              <>
                {/* On an iPhone, in an app's own browser: the App Store first. */}
                <a href={APP_STORE_URL} className="w-full rounded-full py-4 text-lg font-bold text-[#2b0b2e]" style={{ background: "linear-gradient(90deg, #fa51a2, #fb7822)" }}>
                  Join ExpandiaX
                </a>
                <p className="-mt-1 text-xs text-white/55">Free on the App Store. Sign up and you&rsquo;ll follow {first} straight away.</p>
                <Link href="/start" className="text-sm text-white/70 underline">
                  Or join on the web
                </Link>
              </>
            ) : (
              <>
                <Link href="/start" className="w-full rounded-full py-4 text-lg font-bold text-[#2b0b2e]" style={{ background: "linear-gradient(90deg, #fa51a2, #fb7822)" }}>
                  Join ExpandiaX
                </Link>
                <AppStoreBadge height={44} />
              </>
            )}
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
