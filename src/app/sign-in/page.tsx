"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "That email and password don’t match. Check them and try again."
          : signInError.message
      );
      setBusy(false);
      return;
    }
    router.push(params.get("next") ?? "/my-world");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <p className="eyebrow">Sign in</p>
      <h1 className="mt-2 text-3xl md:text-4xl">Welcome back.</h1>

      <div className="mt-8">
        <GoogleSignInButton next={params.get("next") ?? "/my-world"} />
      </div>
      <div className="my-6 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">Email</label>
          <input id="email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium">Password</label>
            <Link href="/forgot-password" className="text-xs text-accent underline-offset-4 hover:underline">Forgot password?</Link>
          </div>
          <input id="password" type="password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </div>
        {error && <p role="alert" className="rounded-lg border border-red-800/20 bg-red-800/5 px-3 py-2 text-sm text-red-800 dark:text-red-400">{error}</p>}
        <button type="submit" className="btn-accent w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-sm text-muted">
        New here?{" "}
        <Link href="/sign-up" className="text-accent underline-offset-4 hover:underline">Create your account</Link>
      </p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
