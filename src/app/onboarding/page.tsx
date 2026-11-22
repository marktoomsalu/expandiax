import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { ProfileSetup } from "@/components/onboarding/ProfileSetup";
import { FlushOnboardingDraft } from "@/components/FlushOnboardingDraft";
import { AcceptInvite } from "@/components/invite/AcceptInvite";
import { hasRealName, nameFromParts } from "@/lib/profileName";
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

  // What their Google or Apple account shared: a name (both), a photo (Google; Apple shares none).
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const suggestedName = str(meta.full_name) ?? str(meta.name) ?? nameFromParts(str(meta.given_name), str(meta.family_name));
  const providerPhoto = !!(str(meta.avatar_url) ?? str(meta.picture));
  const first = (hasRealName(profile.display_name) ? profile.display_name : suggestedName ?? "").trim().split(" ")[0];

  return (
    <div className="mx-auto max-w-md px-5 pb-8 pt-10">
      <FlushOnboardingDraft userId={user.id} />
      <p className="eyebrow">Step 2 of 2</p>
      <h1 className="mt-2 font-serif text-3xl md:text-4xl">
        Make it yours{first ? `, ${first}` : ""}<span className="text-accent">.</span>
      </h1>
      <p className="mt-2 text-sm text-muted">This is how friends will see you. Change anything later in Settings.</p>
      <div className="mt-6">
        <AcceptInvite />
        <ProfileSetup profile={profile} suggestedName={suggestedName} providerPhoto={providerPhoto} />
      </div>
    </div>
  );
}
