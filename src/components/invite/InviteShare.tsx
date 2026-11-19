"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { INVITE_TEXT, inviteUrl } from "@/lib/invite";
import { tapLight, tapSuccess } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/** Your invite link: the phone's share sheet, or copy it. */
export function InviteShare({ username, className, dark = false }: { username: string; className?: string; dark?: boolean }) {
  const [copied, setCopied] = useState(false);
  const url = inviteUrl(username);

  async function share() {
    tapLight();
    try {
      if (navigator.share) {
        await navigator.share({ title: "ExpandiaX", text: INVITE_TEXT, url });
        return;
      }
    } catch {
      return; // Closed the share sheet.
    }
    await copy();
  }
  async function copy() {
    await navigator.clipboard?.writeText(url).catch(() => {});
    tapSuccess();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={cn("w-full", className)}>
      <button type="button" onClick={() => void share()} className="flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-semibold text-white" style={{ background: "linear-gradient(90deg, #fa51a2, #fb7822)" }}>
        <Share2 size={18} aria-hidden /> Share your invite link
      </button>
      <button
        type="button"
        onClick={() => void copy()}
        className={cn("mt-2 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm", dark ? "text-white/75 hover:text-white" : "text-muted hover:text-ink")}
      >
        {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
        <span className="truncate">{copied ? "Copied" : url.replace("https://", "")}</span>
      </button>
    </div>
  );
}
