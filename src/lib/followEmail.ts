import { escapeHtml } from "./unsubscribe";

/** The "X started following you" email. Names are escaped: they're whatever people typed. */
export function followEmail(p: {
  followerName: string;
  followerUsername: string;
  followeeName: string;
  unsubscribe: string;
  site?: string;
}): { subject: string; html: string } {
  const site = p.site ?? "https://expandiax.com";
  const who = escapeHtml(p.followerName);
  return {
    // Subjects are plain text — no escaping needed, but no line breaks either.
    subject: `${p.followerName.replace(/[\r\n]+/g, " ")} started following you`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #17171b;">
        <p style="font-size: 15px; line-height: 1.6;">Hi ${escapeHtml(p.followeeName)},</p>
        <p style="font-size: 15px; line-height: 1.6;"><strong>${who}</strong> (@${escapeHtml(p.followerUsername)}) just started following your world on ExpandiaX.</p>
        <p style="font-size: 15px;"><a href="${site}/u/${encodeURIComponent(p.followerUsername)}" style="color: #e91e63;">See their profile</a></p>
        <p style="font-size: 12px; color: #6b7280; margin-top: 32px;">
          Don&rsquo;t want emails about new followers?
          <a href="${p.unsubscribe}" style="color: #6b7280;">Turn them off with one click</a>, or choose in
          <a href="${site}/settings" style="color: #6b7280;">Settings</a>.
        </p>
      </div>
    `,
  };
}
