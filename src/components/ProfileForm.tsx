"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { COUNTRIES } from "@/lib/countries";
import { validateFile } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";

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
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [bio, setBio] = useState(profile.bio);
  const [homeCountry, setHomeCountry] = useState(profile.home_country_code ?? "");
  const [isPublic, setIsPublic] = useState<boolean | null>(requireVisibilityChoice ? null : profile.is_public);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onAvatar(file: File | undefined) {
    if (!file) return;
    const problem = validateFile(file, "image");
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setAvatarBusy(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${profile.id}/avatar/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("media").upload(path, file);
    if (upErr) {
      setError("Could not upload the photo. Try again.");
      setAvatarBusy(false);
      return;
    }
    const { data } = supabase.storage.from("media").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setAvatarBusy(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (isPublic === null) {
      setError("Choose whether your account is public or private.");
      return;
    }
    setBusy(true);
    const { error: upErr } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || "Traveller",
        bio: bio.trim(),
        home_country_code: homeCountry || null,
        is_public: isPublic,
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
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="Your profile photo" className="h-16 w-16 rounded-full border border-line object-cover" />
        ) : (
          <div aria-hidden className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-raised font-serif text-xl text-muted">
            {displayName.trim().charAt(0).toUpperCase() || "?"}
          </div>
        )}
        <div>
          <label htmlFor="avatar" className="btn-ghost cursor-pointer !py-2 text-sm">
            {avatarBusy ? "Uploading…" : avatarUrl ? "Change photo" : "Add profile photo"}
          </label>
          <input id="avatar" type="file" accept="image/*" className="sr-only" onChange={(e) => onAvatar(e.target.files?.[0])} />
        </div>
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

      <fieldset className={cn("rounded-lg border p-4", isPublic === null ? "border-accent/50" : "border-line")}>
        <legend className="px-1 text-sm font-medium">
          Profile visibility {requireVisibilityChoice && <span className="text-accent">*</span>}
        </legend>
        {requireVisibilityChoice && (
          <p className="mb-3 text-xs text-muted">Required — choose one before continuing.</p>
        )}
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input type="radio" name="visibility" className="mt-0.5 accent-[rgb(var(--accent))]" checked={isPublic === true} onChange={() => setIsPublic(true)} />
          <span><strong className="font-medium">Public</strong> — anyone with your link can see your map, memories and public concerts.</span>
        </label>
        <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm">
          <input type="radio" name="visibility" className="mt-0.5 accent-[rgb(var(--accent))]" checked={isPublic === false} onChange={() => setIsPublic(false)} />
          <span><strong className="font-medium">Private</strong> — only you can see your archive.</span>
        </label>
      </fieldset>

      {error && <p role="alert" className="rounded-lg border border-red-800/20 bg-red-800/5 px-3 py-2 text-sm text-red-800 dark:text-red-400">{error}</p>}
      {saved && <p role="status" className="rounded-lg border border-accent/40 bg-accent-soft/50 px-3 py-2 text-sm">Profile saved.</p>}

      <button type="submit" className="btn-accent" disabled={busy}>
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
