"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${location.origin}/auth/callback?next=/reset-password`,
    });
    setBusy(false);
    if (err) {
      setError("Could not send the reset link. Try again.");
      return;
    }
    setSent(true);
  }

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <p className="eyebrow">Reset password</p>
      <h1 className="mt-2 text-3xl md:text-4xl">Forgot your password?</h1>
      <p className="mt-3 text-sm text-muted">
        Enter the email on your account and we&rsquo;ll send you a link to set a new password.
      </p>

      {sent ? (
        <p role="status" className="mt-8 rounded-lg border border-accent/40 bg-accent-soft/50 px-3 py-2.5 text-sm">
          If an account exists for that email, a reset link is on its way — check your inbox.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">Email</label>
            <input id="email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          {error && <p role="alert" className="rounded-lg border border-red-800/20 bg-red-800/5 px-3 py-2 text-sm text-red-800 dark:text-red-400">{error}</p>}
          <button type="submit" className="btn-accent w-full" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}

      <p className="mt-6 text-sm text-muted">
        <Link href="/sign-in" className="text-accent underline-offset-4 hover:underline">Back to sign in</Link>
      </p>
    </div>
  );
}
