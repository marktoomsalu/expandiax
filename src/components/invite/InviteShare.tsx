"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { inviteMessage, inviteUrl } from "@/lib/invite";
import { tapLight, tapSuccess } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { WhatsAppButton } from "./WhatsAppButton";

/**
 * Your invite link: WhatsApp first (where most invitations go), the phone's
 * share sheet for everything else, or copy it. The message carries the link
 * on its own line, so the preview card shows under it.
 */
export function InviteShare({
  username,
  stats,
  className,
  dark = false,
}: {
  username: string;
  stats?: { countries?: number; events?: number };
  className?: string;
  dark?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const url = inviteUrl(username);
  const message = inviteMessage(url, stats);

  async function share() {
    tapLight();
    try {
      if (navigator.share) {
        // The link inside the text: some apps drop a separate url.
        await navigator.share({ text: message });
        return;
      }
    } catch {
      return; // Closed the share sheet.
    }
    await copy(message);
  }
  async function copy(text = url) {
    await navigator.clipboard?.writeText(text).catch(() => {});
    tapSuccess();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={cn("w-full", className)}>
      <WhatsAppButton text={message} />
      <button
        type="button"
        onClick={() => void share()}
        className={cn(
          "mt-2 flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold ring-1",
          dark ? "text-white ring-white/30 hover:bg-white/10" : "text-ink ring-line hover:bg-raised"
        )}
      >
        <Share2 size={16} aria-hidden /> Other apps
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
