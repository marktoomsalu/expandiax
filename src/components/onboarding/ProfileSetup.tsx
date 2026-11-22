"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { AtSign, Camera, Check, Globe2, ImagePlus, Loader2, Lock, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PLACEHOLDER_NAME, hasRealName } from "@/lib/profileName";
import { countryByCode } from "@/lib/countries";
import { stockPhotoFor, stockUrl } from "@/lib/stockPhotos";
import { preparePhoto } from "@/lib/photoPrepare";
import { loadDraft } from "@/lib/onboardingDraft";
import { loadKeptWorld } from "@/lib/worldScan";
import { validateFile } from "@/lib/media";
import { convertHeic } from "@/lib/heic";
import { tapLight, tapSuccess } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { AvatarCropper } from "@/components/AvatarCropper";
import { CountrySearch } from "@/components/CountrySearch";
import { Burst } from "@/components/worldScan/Burst";
import type { Profile, ProfileVisibility } from "@/lib/types";

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;
const EASE = [0.22, 1, 0.36, 1] as const;
const PINK = "#FA51A2";

type Avatar = { url: string; from: "saved" | "provider" | "picked"; blob?: Blob } | null;
type Cover = { url: string; blob?: Blob } | null;

/** The home the earlier steps found or were told (read before they're saved and cleared). */
function homeFromEarlier(): string | null {
  if (typeof window === "undefined") return null;
  return loadKeptWorld()?.homeCode ?? loadDraft().homeCode ?? null;
}

/** "Mark Toomsalu" → "marktoomsalu": a username from a name, if it makes one. */
function usernameFrom(name: string): string | null {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20);
  return slug.length >= 3 ? slug : null;
}

/**
 * "Make it yours" (step 2 of 2), quick: a live profile card that becomes
 * theirs as they go (photo, name, @username, who sees it), its cover their
 * home country (changeable right there). With Google, their photo and name
 * are already there (the photo saved only if they keep it); with Apple,
 * their name. Home is asked only if the earlier steps didn't find or ask it
 * (those who started with a memory). Everything else is in Settings.
 */
export function ProfileSetup({
  profile,
  suggestedName,
  providerPhoto,
}: {
  profile: Profile;
  /** The name their Google or Apple account shared. */
  suggestedName: string | null;
  /** Their Google account has a photo to offer. */
  providerPhoto: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const reduce = useReducedMotion();

  const [displayName, setDisplayName] = useState(hasRealName(profile.display_name) ? profile.display_name : suggestedName ?? "");
  const autoUsername = /^user_[0-9a-f]+$/.test(profile.username);
  const [username, setUsername] = useState(profile.username);
  const [nameCheck, setNameCheck] = useState<"idle" | "checking" | "free" | "taken" | "invalid">("idle");
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [avatar, setAvatar] = useState<Avatar>(profile.avatar_url ? { url: profile.avatar_url, from: "saved" } : null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [visibility, setVisibility] = useState<ProfileVisibility | null>(null);
  // Read during the first render, before the earlier steps are saved and cleared; shown after it (no mismatch with the server's render).
  const [earlierHome] = useState(homeFromEarlier);
  const knownHome = profile.home_country_code ?? earlierHome;
  const [home, setHome] = useState<string | null>(null);
  const [askHome, setAskHome] = useState(false);
  useEffect(() => {
    setHome(knownHome);
    setAskHome(!knownHome);
  }, [knownHome]);
  const [cover, setCover] = useState<Cover>(profile.cover_url ? { url: profile.cover_url } : null);
  const coverInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visibilityShake = useAnimationControls();
  const fileInput = useRef<HTMLInputElement>(null);

  // Their Google photo, offered: shown on the card, saved only if they keep it.
  useEffect(() => {
    if (profile.avatar_url || !providerPhoto) return;
    let alive = true;
    void fetch("/api/profile/provider-photo")
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (!alive || !blob || !blob.type.startsWith("image/")) return;
        setAvatar((cur) => cur ?? { url: URL.createObjectURL(blob), from: "provider", blob });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [profile.avatar_url, providerPhoto]);

  // A username from their name (while it's still the made-up one and they haven't typed their own).
  useEffect(() => {
    if (!autoUsername || usernameTouched) return;
    const base = usernameFrom(displayName);
    if (!base) return;
    let alive = true;
    const t = setTimeout(async () => {
      const n = () => Math.floor(10 + Math.random() * 89);
      for (const candidate of [base, `${base}${n()}`, `${base}_${n()}`, `${base}${n()}${n()}`]) {
        const { data } = await supabase.from("profiles").select("id").eq("username", candidate).neq("id", profile.id).maybeSingle();
        if (!alive) return;
        if (!data) {
          setUsername(candidate);
          setNameCheck("free");
          return;
        }
      }
    }, 450);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayName, usernameTouched]);

  // Typed their own: is it free?
  useEffect(() => {
    if (!usernameTouched) return;
    const u = username.trim().toLowerCase();
    if (!USERNAME_RE.test(u)) {
      setNameCheck(u ? "invalid" : "idle");
      return;
    }
    if (u === profile.username) {
      setNameCheck("free");
      return;
    }
    setNameCheck("checking");
    let alive = true;
    const t = setTimeout(async () => {
      const { data } = await supabase.from("profiles").select("id").eq("username", u).neq("id", profile.id).maybeSingle();
      if (alive) setNameCheck(data ? "taken" : "free");
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, usernameTouched]);

  async function pick(file: File | undefined) {
    if (!file) return;
    const {
      files: [ready],
      failed,
    } = await convertHeic([file]);
    if (!ready || failed.length) return setError(`Couldn't read “${file.name}”. Try exporting it from Photos as JPEG.`);
    const problem = validateFile(ready, "image");
    if (problem) return setError(problem);
    setError(null);
    setCropSrc(URL.createObjectURL(ready));
  }

  function cropped(blob: Blob) {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    tapLight();
    setAvatar({ url: URL.createObjectURL(blob), from: "picked", blob });
  }

  /** Their own cover: made smaller (and its location dropped) on the phone, uploaded when they continue. */
  async function pickCover(file: File | undefined) {
    if (!file) return;
    const {
      files: [ready],
      failed,
    } = await convertHeic([file]);
    if (!ready || failed.length) return setError(`Couldn't read “${file.name}”. Try exporting it from Photos as JPEG.`);
    const problem = validateFile(ready, "image");
    if (problem) return setError(problem);
    setError(null);
    const small = await preparePhoto(ready);
    tapLight();
    setCover({ url: URL.createObjectURL(small), blob: small });
  }

  async function upload(blob: Blob): Promise<string | null> {
    const path = `${profile.id}/avatar/${crypto.randomUUID()}.jpg`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, blob, { contentType: blob.type || "image/jpeg" });
    return upErr ? null : supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  }

  async function save() {
    setError(null);
    if (!displayName.trim()) return setError("Add your name: it's what friends see.");
    const uname = username.trim().toLowerCase();
    if (!USERNAME_RE.test(uname)) return setError("Usernames are 3–24 characters: lowercase letters, numbers and underscores.");
    if (nameCheck === "taken") return setError(`"${uname}" is taken. Try another.`);
    if (!visibility) {
      tapLight();
      void visibilityShake.start({ x: [0, -8, 8, -6, 6, 0], transition: { duration: 0.45 } });
      return setError("One last thing: choose who can see your world.");
    }
    setBusy(true);
    let avatarUrl: string | null = avatar?.from === "saved" ? avatar.url : null;
    if (avatar?.blob) {
      setAvatarBusy(true);
      avatarUrl = await upload(avatar.blob);
      setAvatarBusy(false);
      if (!avatarUrl) {
        setBusy(false);
        return setError("Couldn't upload the photo. Try again, or remove it for now.");
      }
    }
    let coverUrl: string | null = cover && !cover.blob ? cover.url : null;
    if (cover?.blob) {
      const path = `${profile.id}/cover/${crypto.randomUUID()}.jpg`;
      const { error: coverErr } = await supabase.storage.from("avatars").upload(path, cover.blob, { contentType: cover.blob.type || "image/jpeg" });
      if (coverErr) {
        setBusy(false);
        return setError("Couldn't upload the cover. Try again, or use photos of home.");
      }
      coverUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    }
    if (uname !== profile.username) {
      const { data: taken } = await supabase.from("profiles").select("id").eq("username", uname).neq("id", profile.id).maybeSingle();
      if (taken) {
        setBusy(false);
        setNameCheck("taken");
        return setError(`"${uname}" was just taken. Try another.`);
      }
    }
    const { error: upErr } = await supabase
      .from("profiles")
      .update({
        username: uname,
        display_name: displayName.trim() || PLACEHOLDER_NAME,
        // Home only when it was asked here; otherwise the earlier steps save it.
        ...(askHome && home ? { home_country_code: home } : {}),
        visibility,
        avatar_url: avatarUrl,
        // No cover of their own: their home country's photos take turns at the top (as in Settings).
        cover_url: coverUrl,
      })
      .eq("id", profile.id);
    if (upErr) {
      setBusy(false);
      return setError("Couldn't save your profile. Try again.");
    }
    tapSuccess();
    setDone(true);
    setTimeout(() => {
      router.push("/my-world");
      router.refresh();
    }, reduce ? 0 : 900);
  }

  const first = displayName.trim().split(" ")[0];
  const country = countryByCode(home);
  const homePhoto = home ? stockPhotoFor(home) : null;
  const coverSrc = cover?.url ?? (homePhoto ? stockUrl(homePhoto.raw, 900, "5:2", 75) : null);
  const rise = (i: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, delay: reduce ? 0 : 0.25 + i * 0.07, ease: EASE },
  });

  return (
    <div className="pb-[calc(7rem+env(safe-area-inset-bottom))]">
      {/* The card: theirs, live */}
      <motion.div
        className="relative overflow-hidden rounded-[28px] bg-surface shadow-[0_24px_50px_-28px_rgba(43,11,46,0.55)] ring-1 ring-line"
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 180, damping: 22 }}
      >
        {/* The cover: their own photo, or their home country's; until there's a home, ExpandiaX's colours */}
        <div className="relative h-36 overflow-hidden bg-[linear-gradient(135deg,#fa51a2_0%,#7c1d6f_55%,#2b0b2e_100%)]">
          <AnimatePresence initial={false}>
            {coverSrc && (
              <motion.img
                key={coverSrc}
                src={coverSrc}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.08 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7, ease: EASE }}
              />
            )}
          </AnimatePresence>
          <span className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/25" aria-hidden />
          <button
            type="button"
            onClick={() => coverInput.current?.click()}
            className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm hover:bg-black/50"
          >
            <ImagePlus size={13} aria-hidden /> {cover ? "Change cover" : "Your own cover"}
          </button>
          {cover && (
            <button
              type="button"
              onClick={() => {
                tapLight();
                setCover(null);
              }}
              className="absolute bottom-3 left-3 rounded-full bg-black/35 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm hover:bg-black/50"
            >
              {homePhoto ? "Use photos of home" : "Remove"}
            </button>
          )}
          {/* A slow shine across it */}
          {!reduce && (
            <motion.div
              aria-hidden
              className="absolute inset-y-0 w-24 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent"
              initial={{ x: -140 }}
              animate={{ x: 520 }}
              transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 3.5, ease: "easeInOut" }}
            />
          )}
          <AnimatePresence>
            {visibility && (
              <motion.span
                key={visibility}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/25 px-2.5 py-1 text-[11px] font-semibold text-white"
              >
                {visibility === "private" ? <Lock size={11} aria-hidden /> : <Globe2 size={11} aria-hidden />}
                {visibility === "private" ? "Followers only" : "Everyone"}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="relative px-5 pb-5">
          {/* Their photo, or their initial; tap to change */}
          <div className="-mt-11 flex items-end justify-between">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="relative h-[88px] w-[88px] rounded-full ring-4 ring-surface"
              aria-label={avatar ? "Change your photo" : "Add a photo"}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={avatar?.url ?? "initial"}
                  className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full font-serif text-4xl text-white"
                  style={{ background: avatar ? undefined : PINK }}
                  initial={reduce ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  {avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatar.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (first.charAt(0) || "?").toUpperCase()
                  )}
                </motion.span>
              </AnimatePresence>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-canvas ring-2 ring-surface">
                {avatarBusy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Camera size={15} aria-hidden />}
              </span>
            </button>
            {country && (
              <motion.span key={country.code} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mb-1 rounded-full bg-raised px-3 py-1 text-sm">
                {country.flag} {country.name}
              </motion.span>
            )}
          </div>
          <p className="mt-3 min-h-[2.25rem] font-serif text-[1.75rem] leading-tight">{displayName.trim() || <span className="text-muted/60">Your name</span>}</p>
          <p className="text-sm text-muted">@{username.trim().toLowerCase() || "username"}</p>
        </div>
      </motion.div>

      {/* The photo: where it came from, and both ways out */}
      <motion.div {...rise(0)} className="mt-3 flex min-h-[2rem] flex-wrap items-center justify-center gap-2 text-sm">
        {avatar?.from === "provider" && <span className="text-muted">Your photo from Google</span>}
        <button type="button" onClick={() => fileInput.current?.click()} className="rounded-full px-3 py-1.5 font-medium text-accent hover:bg-accent-soft">
          {avatar ? "Change" : "Add a photo"}
        </button>
        {avatar && (
          <button
            type="button"
            onClick={() => {
              tapLight();
              setAvatar(null);
            }}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-muted hover:bg-raised hover:text-ink"
          >
            <Trash2 size={14} aria-hidden /> Remove
          </button>
        )}
      </motion.div>
      <input
        ref={coverInput}
        type="file"
        accept="image/*,.heic,.heif"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void pickCover(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={fileInput}
        type="file"
        accept="image/*,.heic,.heif"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <div className="mt-6 space-y-5">
        <motion.div {...rise(1)}>
          <label htmlFor="ps-name" className="mb-1.5 block text-sm font-medium">
            Your name
          </label>
          <input id="ps-name" className="field text-lg" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="What friends call you" autoComplete="name" maxLength={60} />
        </motion.div>

        <motion.div {...rise(2)}>
          <label htmlFor="ps-username" className="mb-1.5 block text-sm font-medium">
            Username
          </label>
          <div className="relative">
            <AtSign size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input
              id="ps-username"
              className="field !pl-10 !pr-11"
              value={username}
              onChange={(e) => {
                setUsernameTouched(true);
                setUsername(e.target.value.toLowerCase().replace(/\s/g, ""));
              }}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={24}
              aria-describedby="ps-username-hint"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2" aria-hidden>
              {nameCheck === "checking" && <Loader2 size={17} className="animate-spin text-muted" />}
              {nameCheck === "free" && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <Check size={14} strokeWidth={3} />
                </motion.span>
              )}
              {(nameCheck === "taken" || nameCheck === "invalid") && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white">
                  <X size={14} strokeWidth={3} />
                </span>
              )}
            </span>
          </div>
          <p id="ps-username-hint" className={cn("mt-1.5 text-xs", nameCheck === "taken" || nameCheck === "invalid" ? "text-red-700 dark:text-red-400" : "text-muted")}>
            {nameCheck === "taken"
              ? "Taken. Try another."
              : nameCheck === "invalid"
                ? "3–24 letters, numbers or _"
                : `expandiax.com/u/${username.trim().toLowerCase() || "you"}`}
          </p>
        </motion.div>

        {/* Home: only when the earlier steps didn't find or ask it (they started with a memory). */}
        {askHome && (
          <motion.div {...rise(3)}>
            <p className="mb-1.5 text-sm font-medium">Where&apos;s home?</p>
            {country ? (
              <button type="button" onClick={() => setHome(null)} className="field flex w-full items-center justify-between text-left">
                <span>
                  {country.flag} {country.name}
                </span>
                <span className="text-xs font-medium text-accent">Change</span>
              </button>
            ) : (
              <CountrySearch
                onSelect={(code) => {
                  tapLight();
                  setHome(code);
                }}
                placeholder="Search for your country…"
              />
            )}
            <p className="mt-1.5 text-xs text-muted">It goes on your map, and its photos on your profile.</p>
          </motion.div>
        )}

        <motion.fieldset {...rise(4)}>
          <legend className="mb-2 text-sm font-medium">Who can see your world?</legend>
          <motion.div animate={visibilityShake} className="grid grid-cols-2 gap-3">
            {(
              [
                { v: "public", icon: Globe2, title: "Everyone", text: "Your map and memories, for anyone to see." },
                { v: "private", icon: Lock, title: "Only followers", text: "People ask to follow; you choose who." },
              ] as const
            ).map(({ v, icon: Icon, title, text }) => {
              const on = visibility === v;
              return (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    tapLight();
                    setVisibility(v);
                    setError(null);
                  }}
                  className={cn(
                    "relative rounded-[20px] border-2 p-4 text-left transition-colors",
                    on ? "border-accent bg-accent-soft" : visibility === null && error ? "border-accent/40 bg-surface" : "border-line bg-surface hover:border-accent/40"
                  )}
                >
                  <Icon size={22} className={on ? "text-accent" : "text-muted"} aria-hidden />
                  <span className="mt-2 block font-semibold">{title}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted">{text}</span>
                  <AnimatePresence>
                    {on && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white"
                      >
                        <Check size={14} strokeWidth={3} aria-hidden />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              );
            })}
          </motion.div>
          <p className="mt-2 text-xs text-muted">Either way, each trip and event can still be just for you. Your name, username and photo are always visible to members.</p>
        </motion.fieldset>

      </div>

      {/* Always in reach */}
      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-canvas via-canvas/95 to-transparent px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-8">
        <div className="relative mx-auto max-w-md">
          {done && <Burst />}
          <AnimatePresence>
            {error && (
              <motion.p role="alert" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-2 text-center text-sm font-medium text-accent">
                {error}
              </motion.p>
            )}
          </AnimatePresence>
          <motion.button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            whileTap={{ scale: 0.97 }}
            className="btn-accent flex w-full items-center justify-center gap-2 !rounded-full py-4 text-lg shadow-[0_14px_30px_-12px_rgba(250,81,162,0.75)] disabled:opacity-80"
          >
            {done ? (
              <>
                <Check size={20} strokeWidth={3} aria-hidden /> Welcome{first ? `, ${first}` : ""}!
              </>
            ) : busy ? (
              <>
                <Loader2 size={20} className="animate-spin" aria-hidden /> Saving…
              </>
            ) : (
              "Continue to your world"
            )}
          </motion.button>
        </div>
      </div>

      <AvatarCropper
        open={!!cropSrc}
        imageSrc={cropSrc}
        busy={false}
        onCancel={() => {
          if (cropSrc) URL.revokeObjectURL(cropSrc);
          setCropSrc(null);
        }}
        onConfirm={(blob) => cropped(blob)}
      />
    </div>
  );
}
