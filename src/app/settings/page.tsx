import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/ProfileForm";
import { SignOutButton } from "@/components/SignOutButton";
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
    </div>
  );
}
