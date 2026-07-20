"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

export default function SignUpPage() {
  const router = useRouter();
  const supabase = createClient();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const uname = username.trim().toLowerCase();
    if (!USERNAME_RE.test(uname)) {
      setError("Usernames are 3–24 characters: lowercase letters, numbers and underscores.");
      return;
    }
    if (password.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return;
    }
    setBusy(true);

    const { data: taken } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", uname)
      .maybeSingle();
    if (taken) {
      setError(`“${uname}” is already taken. Try another username.`);
      setBusy(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { username: uname, display_name: displayName.trim() || "Traveller" },
        emailRedirectTo: `${location.origin}/auth/callback?next=/onboarding`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setBusy(false);
      return;
    }
    if (data.session) {
      router.push("/onboarding");
      router.refresh();
    } else {
      setNotice("Almost there — open the confirmation link we sent to your email, then sign in.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <p className="eyebrow">Create account</p>
      <h1 className="mt-2 text-3xl md:text-4xl">Begin your archive.</h1>
      <p className="mt-3 text-sm text-muted">
        One place for every country you&rsquo;ve set foot in and every concert you never want to forget.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="display_name" className="mb-1.5 block text-sm font-medium">Display name</label>
          <input id="display_name" className="field" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Liis Kask" autoComplete="name" />
        </div>
        <div>
          <label htmlFor="username" className="mb-1.5 block text-sm font-medium">Username</label>
          <input id="username" className="field" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="liiskask" required autoComplete="username" aria-describedby="username-hint" />
          <p id="username-hint" className="mt-1 text-xs text-muted">Your public address: expandiax.example/u/{username.trim().toLowerCase() || "username"}</p>
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">Email</label>
          <input id="email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium">Password</label>
          <input id="password" type="password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" aria-describedby="password-hint" />
          <p id="password-hint" className="mt-1 text-xs text-muted">At least 8 characters.</p>
        </div>

        {error && <p role="alert" className="rounded-lg border border-red-800/20 bg-red-800/5 px-3 py-2 text-sm text-red-800 dark:text-red-400">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-accent/40 bg-accent-soft/50 px-3 py-2 text-sm">{notice}</p>}

        <button type="submit" className="btn-accent w-full" disabled={busy}>
          {busy ? "Creating your account…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-sm text-muted">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-accent underline-offset-4 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
