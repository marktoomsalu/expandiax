import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/ProfileForm";

export const metadata = { title: "Set up your profile" };

export default async function OnboardingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/sign-in");

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <p className="eyebrow">Step 2 of 2</p>
      <h1 className="mt-2 text-3xl md:text-4xl">Make it yours, {profile.display_name.split(" ")[0]}.</h1>
      <p className="mt-3 text-sm text-muted">
        A photo and a few words turn a map into a story. You can change all of this later in Settings.
      </p>
      <div className="mt-8">
        <ProfileForm profile={profile} afterSaveHref="/my-world" submitLabel="Continue to your world" />
      </div>
    </div>
  );
}
