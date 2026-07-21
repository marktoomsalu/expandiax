"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError("Could not update your password. The reset link may have expired — request a new one.");
      return;
    }
    router.push("/my-world");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <p className="eyebrow">Reset password</p>
      <h1 className="mt-2 text-3xl md:text-4xl">Choose a new password.</h1>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium">New password</label>
          <input id="password" type="password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" aria-describedby="password-hint" />
          <p id="password-hint" className="mt-1 text-xs text-muted">At least 8 characters.</p>
        </div>
        {error && <p role="alert" className="rounded-lg border border-red-800/20 bg-red-800/5 px-3 py-2 text-sm text-red-800 dark:text-red-400">{error}</p>}
        <button type="submit" className="btn-accent w-full" disabled={busy}>
          {busy ? "Saving…" : "Save new password"}
        </button>
      </form>
    </div>
  );
}
