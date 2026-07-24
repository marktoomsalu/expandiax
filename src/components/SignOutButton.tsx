"use client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({ variant = "inline" }: { variant?: "inline" | "floating" }) {
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (variant === "floating") {
    return (
      <button
        type="button"
        aria-label="Sign out"
        title="Sign out"
        onClick={signOut}
        className="fixed bottom-24 right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface text-muted shadow-lg transition-colors hover:text-red-800 dark:hover:text-red-400"
      >
        <LogOut size={18} />
      </button>
    );
  }

  return (
    <button type="button" className="btn-ghost text-sm" onClick={signOut}>
      <LogOut size={16} /> Sign out
    </button>
  );
}
