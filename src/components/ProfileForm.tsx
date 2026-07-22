"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { COUNTRIES } from "@/lib/countries";
import { validateFile } from "@/lib/media";
import { AvatarCropper } from "./AvatarCropper";
import { cn } from "@/lib/utils";
import type { Profile, ProfileVisibility } from "@/lib/types";

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

export function ProfileForm({
  profile,
  afterSaveHref,
  submitLabel = "Save profile",
  requireVisibilityChoice = false,
}: {
  profile: Profile;
  afterSaveHref?: string;
  submitLabel?: string;
  /** When true, neither Public nor Private is pre-selected — the user must actively pick one. */
  requireVisibilityChoice?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [username, setUsername] = useState(profile.username);
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [bio, setBio] = useState(profile.bio);
  const [homeCountry, setHomeCountry] = useState(profile.home_country_code ?? "");
  const [visibility, setVisibility] = useState<ProfileVisibility | null>(
    requireVisibilityChoice ? null : profile.visibility
  );
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function pickAvatar(file: File | undefined) {
    if (!file) return;
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
    const { error: upErr } = await supabase.storage.from("media").upload(path, blob, { contentType: "image/jpeg" });
    if (upErr) {
      setError("Could not upload the photo. Try again.");
      setAvatarBusy(false);
      return;
    }
    const { data } = supabase.storage.from("media").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setAvatarBusy(false);
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (visibility === null) {
      setError("Choose who can see your account.");
      return;
    }
    const uname = username.trim().toLowerCase();
    if (!USERNAME_RE.test(uname)) {
      setError("Usernames are 3–24 characters: lowercase letters, numbers and underscores.");
      return;
    }
    setBusy(true);
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
        display_name: displayName.trim() || "Traveller",
        bio: bio.trim(),
        home_country_code: homeCountry || null,
        visibility,
        avatar_url: avatarUrl,
      })
      .eq("id", profile.id);
    if (upErr) {
      setError("Could not save your profile. Try again.");
      setBusy(false);
      return;
    }
    if (afterSaveHref) {
      router.push(afterSaveHref);
      router.refresh();
    } else {
      setSaved(true);
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
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              pickAvatar(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div>
        <label htmlFor="pf-username" className="mb-1.5 block text-sm font-medium">Username</label>
        <input
          id="pf-username"
          className="field"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          aria-describedby="pf-username-hint"
        />
        <p id="pf-username-hint" className="mt-1 text-xs text-muted">
          Your public address: expandiax.example/u/{username.trim().toLowerCase() || "username"}
        </p>
      </div>

      <div>
        <label htmlFor="pf-name" className="mb-1.5 block text-sm font-medium">Display name</label>
        <input id="pf-name" className="field" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
      </div>

      <div>
        <label htmlFor="pf-bio" className="mb-1.5 block text-sm font-medium">Biography</label>
        <textarea id="pf-bio" className="field min-h-24" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A line or two about how you travel and what you listen to." maxLength={400} />
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

      <fieldset className={cn("rounded-lg border p-4", visibility === null ? "border-accent/50" : "border-line")}>
        <legend className="px-1 text-sm font-medium">
          Who can see your profile {requireVisibilityChoice && <span className="text-accent">*</span>}
        </legend>
        {requireVisibilityChoice && (
          <p className="mb-3 text-xs text-muted">Required — choose one before continuing.</p>
        )}
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input type="radio" name="visibility" className="mt-0.5 accent-[rgb(var(--accent))]" checked={visibility === "public"} onChange={() => setVisibility("public")} />
          <span><strong className="font-medium">Public</strong> — anyone with your link can see your map, memories and public events.</span>
        </label>
        <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm">
          <input type="radio" name="visibility" className="mt-0.5 accent-[rgb(var(--accent))]" checked={visibility === "friends"} onChange={() => setVisibility("friends")} />
          <span><strong className="font-medium">Friends only</strong> — visible only to people who follow you back (mutual followers).</span>
        </label>
        <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm">
          <input type="radio" name="visibility" className="mt-0.5 accent-[rgb(var(--accent))]" checked={visibility === "private"} onChange={() => setVisibility("private")} />
          <span><strong className="font-medium">Private</strong> — only you can see your archive.</span>
        </label>
      </fieldset>

      {error && <p role="alert" className="rounded-lg border border-red-800/20 bg-red-800/5 px-3 py-2 text-sm text-red-800 dark:text-red-400">{error}</p>}
      {saved && <p role="status" className="rounded-lg border border-accent/40 bg-accent-soft/50 px-3 py-2 text-sm">Profile saved.</p>}

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
