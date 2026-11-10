"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { hasRealName, PLACEHOLDER_NAME } from "@/lib/profileName";
import { COUNTRIES } from "@/lib/countries";
import { validateFile } from "@/lib/media";
import { convertHeic } from "@/lib/heic";
import { AvatarCropper } from "./AvatarCropper";
import { StockImage } from "./StockImage";
import type { StockPhoto } from "@/lib/stockPhotos";
import { preparePhoto } from "@/lib/photoPrepare";
import { cn } from "@/lib/utils";
import type { Profile, ProfileVisibility } from "@/lib/types";

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;
// ExpandiaX's own pink (--accent in globals.css, the logo's #FA51A2).
const DEFAULT_ACCENT = "#FA51A2";

export function ProfileForm({
  profile,
  afterSaveHref,
  submitLabel = "Save profile",
  requireVisibilityChoice = false,
  homeCover = null,
}: {
  profile: Profile;
  /** Today's photo of their home country: the cover when they haven't picked their own. */
  homeCover?: StockPhoto | null;
  afterSaveHref?: string;
  submitLabel?: string;
  /** When true, neither Public nor Private is pre-selected — the user must actively pick one. */
  requireVisibilityChoice?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [username, setUsername] = useState(profile.username);
  // "Traveller" is only a placeholder: show an empty field so people give their own name.
  const [displayName, setDisplayName] = useState(hasRealName(profile.display_name) ? profile.display_name : "");
  const [bio, setBio] = useState(profile.bio);
  const [homeCountry, setHomeCountry] = useState(profile.home_country_code ?? "");
  const [visibility, setVisibility] = useState<ProfileVisibility | null>(
    requireVisibilityChoice ? null : profile.visibility
  );
  const [discoverable, setDiscoverable] = useState(profile.discoverable ?? true);
  const [accentColor, setAccentColor] = useState(profile.accent_color ?? DEFAULT_ACCENT);
  // null = ExpandiaX's own pink (nothing saved), otherwise the chosen colour.
  const [accentChoice, setAccentChoice] = useState<string | null>(profile.accent_color ?? null);
  const [coverUrl, setCoverUrl] = useState<string | null>(profile.cover_url ?? null);
  const [coverBusy, setCoverBusy] = useState(false);

  async function pickCover(picked: File | undefined) {
    if (!picked) return;
    const {
      files: [file],
      failed,
    } = await convertHeic([picked]);
    if (!file || failed.length) {
      setError(`Couldn't read “${picked.name}”. Try exporting it from Photos as JPEG.`);
      return;
    }
    const problem = validateFile(file, "image");
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setCoverBusy(true);
    // Shrunk and stripped of location data on the phone first, like every photo.
    const ready = await preparePhoto(file);
    const path = `${profile.id}/cover/${crypto.randomUUID()}.jpg`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, ready, { contentType: ready.type || "image/jpeg" });
    setCoverBusy(false);
    if (upErr) {
      setError("Could not upload the cover photo. Try again.");
      return;
    }
    setCoverUrl(supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl);
  }
  // Private to public: the answer to "show your posts to everyone too?".
  const [askOpen, setAskOpen] = useState(false);
  const [openChoice, setOpenChoice] = useState<"all" | "choose" | null>(null);
  // Answered: carry on saving.
  useEffect(() => {
    if (openChoice) void onSubmit();
  }, [openChoice]); // eslint-disable-line react-hooks/exhaustive-deps
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | false>(false);

  async function pickAvatar(picked: File | undefined) {
    if (!picked) return;
    // iPhone (HEIC) photos become JPEGs first — see lib/heic.ts.
    const {
      files: [file],
      failed,
    } = await convertHeic([picked]);
    if (!file || failed.length) {
      setError(`Couldn't read “${picked.name}”. Try exporting it from Photos as JPEG.`);
      return;
    }
    const problem = validateFile(file, "image");
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setCropSrc(URL.createObjectURL(file));
  }

  function cancelCrop() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  async function onAvatarCropped(blob: Blob) {
    setAvatarBusy(true);
    const path = `${profile.id}/avatar/${crypto.randomUUID()}.jpg`;
    // Profile photos live in their own public bucket; memories stay private.
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg" });
    if (upErr) {
      setError("Could not upload the photo. Try again.");
      setAvatarBusy(false);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setAvatarBusy(false);
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  async function onSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setSaved(false);
    if (visibility === null) {
      setError("Choose who can see your account.");
      return;
    }
    if (!displayName.trim()) {
      setError("Add a display name: it's what friends see.");
      return;
    }
    const uname = username.trim().toLowerCase();
    if (!uname) {
      setError("Choose a username.");
      return;
    }
    if (!USERNAME_RE.test(uname)) {
      setError("Usernames are 3–24 characters: lowercase letters, numbers and underscores.");
      return;
    }
    // Going from private to public: ask whether posts open up too.
    if (profile.visibility === "private" && visibility === "public" && !openChoice) {
      setAskOpen(true);
      return;
    }
    setBusy(true);
    if (openChoice === "choose") {
      // "No, I'll choose": posts for everyone become posts for friends, so nothing new turns public.
      const { error: rpcErr } = await supabase.rpc("posts_to_friends");
      if (rpcErr) {
        setError("Could not keep your posts to friends. Try again.");
        setBusy(false);
        return;
      }
    }
    if (uname !== profile.username) {
      const { data: taken } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", uname)
        .neq("id", profile.id)
        .maybeSingle();
      if (taken) {
        setError(`"${uname}" is already taken. Try another username.`);
        setBusy(false);
        return;
      }
    }
    const { error: upErr } = await supabase
      .from("profiles")
      .update({
        username: uname,
        display_name: displayName.trim() || PLACEHOLDER_NAME,
        bio: bio.trim(),
        home_country_code: homeCountry || null,
        visibility,
        discoverable,
        avatar_url: avatarUrl,
        // Only a colour someone actually chose; "Default" saves nothing.
        accent_color: accentChoice,
        // Only sent when it changed.
        ...(coverUrl !== (profile.cover_url ?? null) ? { cover_url: coverUrl } : {}),
      })
      .eq("id", profile.id);
    if (upErr) {
      setError("Could not save your profile. Try again.");
      setBusy(false);
      return;
    }
    const kept = openChoice === "choose";
    setOpenChoice(null);
    if (afterSaveHref) {
      router.push(afterSaveHref);
      router.refresh();
    } else {
      setSaved(kept ? "Profile saved. Your posts are for friends: open up the ones you want from each trip or event." : "Profile saved");
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          <Image src={avatarUrl} alt="Your profile photo" width={64} height={64} className="h-16 w-16 rounded-full border border-line object-cover" />
        ) : (
          <div aria-hidden className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-raised font-serif text-xl text-muted">
            {displayName.trim().charAt(0).toUpperCase() || "?"}
          </div>
        )}
        <div>
          <label htmlFor="avatar" className="btn-ghost cursor-pointer !py-2 text-sm">
            {avatarBusy ? "Uploading…" : avatarUrl ? "Change photo" : "Add profile photo"}
          </label>
          <input
            id="avatar"
            type="file"
            accept="image/*,.heic,.heif"
            className="sr-only"
            onChange={(e) => {
              void pickAvatar(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div>
        <label htmlFor="pf-username" className="mb-1.5 block text-sm font-medium">Username <span className="text-accent" aria-hidden>*</span></label>
        <input
          id="pf-username"
          className="field"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          aria-describedby="pf-username-hint"
        />
        <p id="pf-username-hint" className="mt-1 text-xs text-muted">
          Your public address: expandiax.com/u/{username.trim().toLowerCase() || "username"}
        </p>
      </div>

      <div>
        <label htmlFor="pf-name" className="mb-1.5 block text-sm font-medium">Display name <span className="text-accent" aria-hidden>*</span></label>
        <input
          id="pf-name"
          className="field"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your name"
          autoComplete="name"
          maxLength={80}
          required
          aria-describedby="pf-name-hint"
        />
        <p id="pf-name-hint" className="mt-1 text-xs text-muted">What friends see on your profile and in their feed.</p>
      </div>

      <div>
        <label htmlFor="pf-bio" className="block text-sm font-medium">Biography</label>
        <p id="pf-bio-hint" className="mb-1.5 mt-0.5 text-xs text-muted">A little about you and what you love…</p>
        <textarea id="pf-bio" className="field min-h-24" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={400} aria-describedby="pf-bio-hint" />
      </div>

      <div>
        <label htmlFor="pf-home" className="mb-1.5 block text-sm font-medium">Home country</label>
        <select id="pf-home" className="field" value={homeCountry} onChange={(e) => setHomeCountry(e.target.value)}>
          <option value="">Choose a country</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <p className="mb-1.5 block text-sm font-medium">Cover photo</p>
        <div className="relative h-28 overflow-hidden rounded-2xl border border-line" style={{ backgroundColor: homeCover?.color ?? "#2b0b2e" }}>
          {coverUrl ? (
            <Image src={coverUrl} alt="Your cover photo" fill sizes="448px" className="object-cover" />
          ) : homeCover ? (
            <StockImage photo={homeCover} alt="" sizes="448px" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#2b0b2e] via-[#7c1d6f] to-[#fb7822]" aria-hidden />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/30" aria-hidden />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label htmlFor="cover" className="btn-ghost cursor-pointer !py-2 text-sm">
            {coverBusy ? "Uploading…" : coverUrl ? "Change cover" : "Add your own cover"}
          </label>
          <input
            id="cover"
            type="file"
            accept="image/*,.heic,.heif"
            className="sr-only"
            onChange={(e) => {
              void pickCover(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {coverUrl && (
            <button type="button" onClick={() => setCoverUrl(null)} className="text-sm font-medium text-accent hover:underline">
              Use photos of my home country
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">Without your own, photos of your home country take turns at the top of your profile.</p>
      </div>

      <div>
        <label htmlFor="pf-accent" className="mb-1.5 block text-sm font-medium">Profile accent color</label>
        <div className="flex items-center gap-3">
          <input
            id="pf-accent"
            type="color"
            className="h-10 w-14 cursor-pointer rounded-md border border-line bg-transparent p-1"
            value={accentColor}
            onChange={(e) => {
              setAccentColor(e.target.value);
              setAccentChoice(e.target.value);
            }}
          />
          <button
            type="button"
            onClick={() => {
              setAccentColor(DEFAULT_ACCENT);
              setAccentChoice(null);
            }}
            aria-pressed={accentChoice === null}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
              accentChoice === null ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink"
            )}
          >
            <span className="h-3 w-3 rounded-full" style={{ background: DEFAULT_ACCENT }} aria-hidden /> Default
          </button>
          <p className="text-xs text-muted">Colors your public profile page - links, buttons and highlights.</p>
        </div>
      </div>

      <fieldset className={cn("rounded-lg border p-4", visibility === null ? "border-accent/50" : "border-line")}>
        <legend className="px-1 text-sm font-medium">
          Who can see your profile {requireVisibilityChoice && <span className="text-accent">*</span>}
        </legend>
        {requireVisibilityChoice && (
          <p className="mb-3 text-xs text-muted">Required - choose one before continuing.</p>
        )}
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input type="radio" name="visibility" className="mt-0.5 accent-[rgb(var(--accent))]" checked={visibility === "public"} onChange={() => setVisibility("public")} />
          <span><strong className="font-medium">Public</strong> - anyone can see your map, memories and events.</span>
        </label>
        <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm">
          <input type="radio" name="visibility" className="mt-0.5 accent-[rgb(var(--accent))]" checked={visibility === "private"} onChange={() => setVisibility("private")} />
          <span><strong className="font-medium">Private</strong> - people ask to follow you. Others still find you and see your name, bio and follower numbers, but only followers you approve see your map and memories.</span>
        </label>
        <p className="mt-3 text-xs text-muted">
          Whichever you choose, members can see your name, username, profile photo and bio (on your comments, for example).
          Each trip, stay and event also has its own audience: Feed, Friends (people who follow each other) or Only me.
        </p>
        <label className="mt-4 flex cursor-pointer items-start gap-3 border-t border-line pt-4 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent))]" checked={discoverable} onChange={(e) => setDiscoverable(e.target.checked)} />
          <span>
            <strong className="block font-medium">Show me in search and suggestions</strong>
            <span className="mt-0.5 block text-xs text-muted">
              Turn this off to hide your profile from search results, friend suggestions, lists of people who have visited a place and
              traveller counts. Your existing followers can still see your profile as usual.
            </span>
          </span>
        </label>
      </fieldset>

      {error && <p role="alert" className="rounded-lg border border-red-800/20 bg-red-800/5 px-3 py-2 text-sm text-red-800 dark:text-red-400">{error}</p>}
      {saved && <SavedOverlay text={saved} onClose={() => setSaved(false)} />}
      {askOpen && (
        <GoPublicDialog
          onChoose={(choice) => {
            setAskOpen(false);
            setOpenChoice(choice);
          }}
          onCancel={() => setAskOpen(false)}
        />
      )}

      <button type="submit" className="btn-accent" disabled={busy}>
        {busy ? "Saving…" : submitLabel}
      </button>

      <AvatarCropper
        open={!!cropSrc}
        imageSrc={cropSrc}
        busy={avatarBusy}
        onCancel={cancelCrop}
        onConfirm={onAvatarCropped}
      />
    </form>
  );
}

/** "Profile saved" in the middle of the screen: gone by itself, or with a tap anywhere. */
function SavedOverlay({ text, onClose }: { text: string; onClose: () => void }) {
  // The latest onClose, without restarting the timer whenever the form re-renders.
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const t = setTimeout(() => close.current(), text.length > 20 ? 4500 : 1800);
    return () => clearTimeout(t);
  }, [text]);
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={`${text} Tap to close.`}
      className="fixed inset-0 z-[90] flex cursor-default items-center justify-center bg-black/20 backdrop-blur-[2px]"
    >
      <span role="status" className="saved-pop flex items-center gap-2.5 rounded-2xl bg-surface px-6 py-4 text-base font-medium text-ink shadow-2xl">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-white">
          <Check size={16} strokeWidth={3} />
        </span>
        <span className="max-w-[16rem]">{text}</span>
      </span>
      <style>{`.saved-pop{animation:saved-pop .35s cubic-bezier(.2,1.3,.4,1) both}@keyframes saved-pop{from{transform:scale(.85);opacity:0}}@media (prefers-reduced-motion:reduce){.saved-pop{animation:none}}`}</style>
    </button>
  );
}

/** "Your account will be public. Show your posts to everyone too?" */
function GoPublicDialog({ onChoose, onCancel }: { onChoose: (choice: "all" | "choose") => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-4 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true" aria-labelledby="go-public-h">
      <div className="w-full max-w-sm rounded-3xl bg-surface p-6 shadow-2xl">
        <h2 id="go-public-h" className="font-serif text-2xl">Make your posts public too?</h2>
        <p className="mt-2 text-sm text-muted">
          Your account will be public. Your trips, stays and events shared with your followers can become visible to everyone, or you can keep them
          to friends and choose which ones to open up.
        </p>
        <div className="mt-6 space-y-2">
          <button type="button" onClick={() => onChoose("all")} className="btn-accent w-full justify-center">
            Yes, show them to everyone
          </button>
          <button type="button" onClick={() => onChoose("choose")} className="btn-ghost w-full justify-center">
            No, I&rsquo;ll choose myself
          </button>
          <button type="button" onClick={onCancel} className="w-full py-2 text-sm text-muted hover:text-ink">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
