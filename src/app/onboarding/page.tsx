import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/ProfileForm";
import { FlushOnboardingDraft } from "@/components/FlushOnboardingDraft";
import { AcceptInvite } from "@/components/invite/AcceptInvite";
import { hasRealName } from "@/lib/profileName";
import { ExistingAccountLanding } from "@/components/ExistingAccountLanding";

export const metadata = { title: "Set up your profile" };

export default async function OnboardingPage() {
  const supabase = createClient();
  const user = await getAuthUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/sign-in");

  // "Sign up with Google" with an account that already exists signs into
  // it: nothing from the first steps (a found world, a first memory) goes
  // into it, and it's straight to their world. A new account has nothing
  // yet, however long its email confirmation took.
  const [{ count: countries }, { count: events }] = await Promise.all([
    supabase.from("visited_countries").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);
  if ((countries ?? 0) > 0 || (events ?? 0) > 0) return <ExistingAccountLanding />;

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <FlushOnboardingDraft userId={user.id} />
      <p className="eyebrow">Step 2 of 2</p>
      <h1 className="mt-2 text-3xl md:text-4xl">
        {hasRealName(profile.display_name) ? `Make it yours, ${profile.display_name.trim().split(" ")[0]}.` : "Make it yours."}
      </h1>
      <p className="mt-3 text-sm text-muted">
        A photo and a few words turn a map into a story. You can change all of this later in Settings.
      </p>
      <div className="mt-8">
        <AcceptInvite />
        <ProfileForm profile={profile} afterSaveHref="/my-world" submitLabel="Continue to your world" requireVisibilityChoice />
      </div>
    </div>
  );
}
