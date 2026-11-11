import Link from "next/link";
import { Check, Lock } from "lucide-react";
import { BADGE_GROUP_LABELS, BADGE_GROUPS, type EvaluatedBadge } from "@/lib/badges";
import { AddCountryButton } from "./AddCountrySheet";

/**
 * Badges by group. Earned ones shine; locked ones (with `showLocked`) say
 * how to get them, how far along you are ("3/5 friends joined") and, with
 * `actions`, offer the way there: Add a country, Add an event, Invite friends.
 */
export function BadgeGrid({ badges, showLocked = true, actions = false }: { badges: EvaluatedBadge[]; showLocked?: boolean; actions?: boolean }) {
  const visible = showLocked ? badges : badges.filter((b) => b.isUnlocked);
  if (visible.length === 0) return null;

  return (
    <div className="space-y-8">
      {BADGE_GROUPS.map((group) => {
        const items = visible.filter((b) => b.group === group);
        if (items.length === 0) return null;
        const earned = items.filter((b) => b.isUnlocked).length;
        return (
          <div key={group}>
            <div className="flex items-baseline justify-between">
              <p className="eyebrow">{BADGE_GROUP_LABELS[group]}</p>
              {showLocked && (
                <p className="text-xs text-muted">
                  {earned}/{items.length}
                </p>
              )}
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((b) => (
                <BadgeCard key={b.id} b={b} actions={actions} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function BadgeCard({ b, actions }: { b: EvaluatedBadge; actions: boolean }) {
  const pct = Math.min(100, (b.current / b.target) * 100);
  const button = "mt-3 inline-flex w-full items-center justify-center rounded-full border border-accent/50 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent-soft";

  if (b.isUnlocked) {
    return (
      <li className="relative isolate flex flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-accent-soft to-surface p-3.5 shadow-sm ring-1 ring-accent/40">
        <span aria-hidden className="animate-badge-shimmer pointer-events-none absolute inset-y-0 left-0 -z-10 w-1/2 bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/10" />
        <span aria-hidden className="gradient-travel flex h-11 w-11 items-center justify-center rounded-full text-white shadow-md shadow-accent/30">
          <b.icon size={20} />
        </span>
        <p className="mt-2.5 text-sm font-semibold leading-tight">{b.label}</p>
        <p className="mt-0.5 text-xs text-muted">{b.description}</p>
        <p className="mt-auto inline-flex items-center gap-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-accent">
          <Check size={12} aria-hidden /> Earned
        </p>
      </li>
    );
  }

  return (
    <li className="flex flex-col rounded-2xl border border-line bg-surface p-3.5">
      <span aria-hidden className="relative flex h-11 w-11 items-center justify-center rounded-full bg-raised text-muted">
        <b.icon size={20} />
        <span className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-surface p-0.5 ring-1 ring-line">
          <Lock size={9} />
        </span>
      </span>
      <p className="mt-2.5 text-sm font-semibold leading-tight text-ink/80">{b.label}</p>
      <p className="mt-0.5 text-xs text-muted">{b.description}</p>
      {b.target > 1 && (
        <div className="mt-2.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuemin={0} aria-valuemax={b.target} aria-valuenow={b.current} aria-label={`${b.label} progress`}>
            <div className="gradient-travel h-full rounded-full transition-all" style={{ width: `${Math.max(pct, b.current > 0 ? 6 : 0)}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-muted">
            <span className="font-semibold text-ink">
              {b.current}/{b.target}
            </span>{" "}
            {b.unit}
          </p>
        </div>
      )}
      {actions && (
        <div className="mt-auto">
          {"addCountry" in b.action ? (
            <AddCountryButton className={button}>{b.action.label}</AddCountryButton>
          ) : (
            <Link href={b.action.href} className={button}>
              {b.action.label}
            </Link>
          )}
        </div>
      )}
    </li>
  );
}
