"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { FaceStack } from "./FaceStack";

export type RowPerson = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  following: boolean;
  line: string; // "Around Norway · 24 – 27 Apr 2025"
  href: string;
};
export type Row = { key: string; label: string; people: RowPerson[] };

/**
 * "3 people you follow have been here · View" — a row per circle, LinkedIn
 * style; View opens who they are and what they did there.
 */
export function NetworkRows({ rows }: { rows: Row[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!rows.length) return null;
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {rows.map((r) => {
        const expanded = open === r.key;
        return (
          <li key={r.key}>
            <div className="flex items-center gap-3 px-4 py-3.5">
              <FaceStack people={r.people} size={36} />
              <p className="min-w-0 flex-1 text-sm font-medium leading-snug">{r.label}</p>
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : r.key)}
                aria-expanded={expanded}
                className="shrink-0 rounded-full border border-accent px-4 py-1.5 text-sm font-semibold text-accent transition-colors hover:bg-accent-soft"
              >
                {expanded ? "Hide" : "View"}
              </button>
            </div>
            {expanded && (
              <ul className="border-t border-line bg-raised/50">
                {r.people.map((p) => (
                  <li key={p.id}>
                    <Link href={p.href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-raised">
                      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-raised font-serif text-sm text-muted">
                        {p.avatar_url ? <Image src={p.avatar_url} alt="" fill sizes="36px" className="object-cover" /> : p.display_name.charAt(0)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          <span className="truncate">{p.display_name}</span>
                          {p.following && <span className="shrink-0 rounded-full bg-accent-soft px-1.5 py-px text-[10px] font-semibold text-accent">Following</span>}
                        </span>
                        <span className="block truncate text-xs text-muted">{p.line}</span>
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
