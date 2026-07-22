import { BADGE_GROUP_LABELS, type BadgeGroup, type EvaluatedBadge } from "@/lib/badges";
import { cn } from "@/lib/utils";

const GROUPS: BadgeGroup[] = ["countries", "continents", "events", "types", "curation"];

export function BadgeGrid({ badges, showLocked = true }: { badges: EvaluatedBadge[]; showLocked?: boolean }) {
  const visible = showLocked ? badges : badges.filter((b) => b.isUnlocked);
  if (visible.length === 0) return null;

  return (
    <div className="space-y-8">
      {GROUPS.map((group) => {
        const items = visible.filter((b) => b.group === group);
        if (items.length === 0) return null;
        return (
          <div key={group}>
            <p className="eyebrow">{BADGE_GROUP_LABELS[group]}</p>
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((b) => (
                <li
                  key={b.id}
                  className={cn("card flex items-start gap-3 px-4 py-3.5", !b.isUnlocked && "opacity-50")}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                      b.isUnlocked ? "bg-accent-soft text-accent" : "bg-raised text-muted"
                    )}
                  >
                    <b.icon size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{b.label}</p>
                    <p className="mt-0.5 text-xs text-muted">{b.description}</p>
                    {!b.isUnlocked && b.target > 1 && (
                      <>
                        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-raised">
                          <div
                            className="h-full rounded-full bg-accent transition-all"
                            style={{ width: `${Math.min(100, (b.current / b.target) * 100)}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[0.6875rem] text-muted">{b.current}/{b.target}</p>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
