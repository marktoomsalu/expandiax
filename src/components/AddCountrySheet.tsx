"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CountrySearch } from "./CountrySearch";

export type AddCountrySheetHandle = { open: () => void };

/**
 * "Add a country": a search that opens on top of whatever you're looking
 * at, with the keyboard already up, instead of scrolling My World to its
 * search box. Picking a country opens that country's page to add the visit.
 */
export const AddCountrySheet = forwardRef<AddCountrySheetHandle>(function AddCountrySheet(_, ref) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const [visited, setVisited] = useState<string[]>([]);

  useImperativeHandle(ref, () => ({
    open() {
      // Both in the same tap, so the phone shows the keyboard straight away.
      dialog.current?.showModal();
      input.current?.focus();
      void loadVisited();
    },
  }));

  async function loadVisited() {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { data } = await supabase.from("visited_countries").select("country_code").eq("user_id", auth.user.id);
    setVisited((data ?? []).map((r) => r.country_code));
  }

  function go(code: string) {
    dialog.current?.close();
    router.push(`/my-world/${code.toLowerCase()}`);
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="add-country-h"
      onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
      style={{ marginTop: "calc(env(safe-area-inset-top) + 72px)", marginBottom: "auto" }}
      className="w-[min(94vw,32rem)] overflow-visible rounded-[28px] border border-line bg-surface p-5 text-ink shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 id="add-country-h" className="font-serif text-2xl">Add a country</h2>
        <button type="button" onClick={() => dialog.current?.close()} aria-label="Close" className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-raised hover:text-ink">
          <X size={18} />
        </button>
      </div>
      <CountrySearch inputRef={input} onSelect={go} visitedCodes={visited} placeholder="Where have you been?" />
    </dialog>
  );
});

/** A button that opens the "Add a country" sheet. */
export function AddCountryButton({ className, children }: { className?: string; children: React.ReactNode }) {
  const sheet = useRef<AddCountrySheetHandle>(null);
  return (
    <>
      <button type="button" className={className} onClick={() => sheet.current?.open()}>
        {children}
      </button>
      <AddCountrySheet ref={sheet} />
    </>
  );
}
