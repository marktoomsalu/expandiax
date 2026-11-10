import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/ProfileForm";
import { SignOutButton } from "@/components/SignOutButton";
import { ExportDataButton, DeleteAccountButton } from "@/components/AccountActions";
import { EmailToggle } from "@/components/EmailToggle";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = createClient();
  const user = await getAuthUser();
  if (!user) redirect("/sign-in");
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/sign-in");

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <p className="eyebrow">Settings</p>
      <h1 className="mt-2 text-3xl md:text-4xl">Your profile</h1>
      <p className="mt-2 text-sm text-muted">
        @{profile.username} · member since {formatDate(profile.created_at)}
      </p>
      <div className="mt-8">
        <ProfileForm profile={profile} />
      </div>
      <div className="mt-10 border-t border-line pt-6">
        <Link href={`/u/${profile.username}?preview=1`} className="text-sm text-accent underline-offset-4 hover:underline">
          View public profile
        </Link>
      </div>

      <div className="mt-8 space-y-4 border-t border-line pt-6">
        <section id="emails" aria-labelledby="emails-h" className="scroll-mt-24">
          <p id="emails-h" className="text-sm font-medium">Emails</p>
          <p className="mt-1 text-xs text-muted">
            Push notifications on your phone are separate - you choose those in your phone&rsquo;s Settings.
          </p>
          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm">New followers</p>
                <p className="mt-0.5 text-xs text-muted">An email when someone starts following you.</p>
              </div>
              <EmailToggle userId={user.id} column="follow_email_enabled" label="Emails about new followers" initialEnabled={profile.follow_email_enabled} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm">Weekly digest</p>
                <p className="mt-0.5 text-xs text-muted">New followers, likes and comments, once a week.</p>
              </div>
              <EmailToggle userId={user.id} column="weekly_digest_enabled" label="Weekly digest email" initialEnabled={profile.weekly_digest_enabled} />
            </div>
          </div>
        </section>
        <div>
          <p className="text-sm font-medium">Blocked accounts</p>
          <p className="mt-1 text-xs text-muted">People you&rsquo;ve blocked can&rsquo;t see you, and you can&rsquo;t see them.</p>
          <Link href="/settings/blocked" className="btn-ghost mt-3 !py-2 text-sm">Manage blocked accounts</Link>
        </div>
        <div>
          <p className="text-sm font-medium">Your data</p>
          <p className="mt-1 text-xs text-muted">Download everything you&rsquo;ve added, as a single file.</p>
          <div className="mt-3"><ExportDataButton userId={user.id} /></div>
        </div>
        <div>
          <p className="text-sm font-medium text-red-800 dark:text-red-400">Danger zone</p>
          <p className="mt-1 text-xs text-muted">Permanently delete your account and everything in it.</p>
          <div className="mt-3"><DeleteAccountButton userId={user.id} /></div>
        </div>
      </div>

      <div className="mt-8 flex justify-end border-t border-line pt-6">
        <SignOutButton />
      </div>
    </div>
  );
}
