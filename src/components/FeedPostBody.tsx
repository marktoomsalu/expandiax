"use client";

import { useState } from "react";
import Link from "next/link";
import { Languages } from "lucide-react";

type Props = {
  href: string;
  flag?: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  metaLine?: React.ReactNode;
};

export function FeedPostBody({ href, flag, title, subtitle, body, metaLine }: Props) {
  const [translated, setTranslated] = useState<{ title: string; subtitle: string | null; body: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleTranslate() {
    if (translated) {
      setTranslated(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: [title, subtitle ?? "", body ?? ""], targetLang: navigator.language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "failed");
      setTranslated({
        title: data.translations[0] ?? title,
        subtitle: subtitle ? data.translations[1] ?? subtitle : null,
        body: body ? data.translations[2] ?? body : null,
      });
    } catch (e) {
      setError(e instanceof Error && e.message !== "failed" ? e.message : "Couldn't translate this post.");
    }
    setBusy(false);
  }

  const shownTitle = translated?.title ?? title;
  const shownSubtitle = translated?.subtitle ?? subtitle;
  const shownBody = translated?.body ?? body;

  return (
    <div>
      <Link href={href} className="mt-3 block hover:text-accent">
        <p className="font-serif text-lg text-ink">
          {flag && <>{flag} </>}
          {shownTitle}
        </p>
        {shownSubtitle && <p className="text-sm italic text-muted">{shownSubtitle}</p>}
        {metaLine}
        {shownBody && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink">{shownBody}</p>}
      </Link>
      <button
        type="button"
        onClick={toggleTranslate}
        disabled={busy}
        className="mt-2 inline-flex items-center gap-1 text-xs text-muted hover:text-accent disabled:opacity-50"
      >
        <Languages size={12} aria-hidden />
        {busy ? "Translating…" : translated ? "Show original" : "Translate"}
      </button>
      {error && <p role="alert" className="mt-1 text-xs text-red-800 dark:text-red-400">{error}</p>}
    </div>
  );
}
