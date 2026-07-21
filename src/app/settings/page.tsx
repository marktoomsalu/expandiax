import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/ProfileForm";
import { SignOutButton } from "@/components/SignOutButton";
import { ExportDataButton, DeleteAccountButton } from "@/components/AccountActions";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
      <div className="mt-10 flex items-center justify-between border-t border-line pt-6">
        <Link href={`/u/${profile.username}`} className="text-sm text-accent underline-offset-4 hover:underline">
          View public profile
        </Link>
        <SignOutButton />
      </div>

      <div className="mt-8 space-y-4 border-t border-line pt-6">
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
    </div>
  );
}
