import Image from "next/image";
import Link from "next/link";
import { countryByCode } from "@/lib/countries";
import { flagGradientColors } from "@/lib/flagColors";

const SHOWN = 12;

/**
 * Several bare countries someone added in one go, as one card: a mosaic of
 * their flags and a link to their map. For someone new, it doubles as a
 * welcome ("joined ExpandiaX · has been to 23 countries").
 */
export function CountryBurstCard({
  actor,
  codes,
  isNewMember,
  when,
}: {
  actor: { username: string; display_name: string; avatar_url: string | null };
  codes: string[];
  isNewMember: boolean;
  when: string;
}) {
  const first = actor.display_name.split(" ")[0];
  const countries = codes.map((c) => countryByCode(c)).filter((c): c is NonNullable<typeof c> => !!c);
  const n = countries.length;
  return (
    <Link href={`/u/${actor.username}`} className="block p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-raised font-serif text-sm text-muted">
          {actor.avatar_url ? <Image src={actor.avatar_url} alt="" width={36} height={36} className="h-full w-full object-cover" /> : actor.display_name.charAt(0)}
        </span>
        <div className="min-w-0 leading-tight">
          <p className="text-sm font-semibold">{actor.display_name}</p>
          <p className="text-xs text-muted">
            {isNewMember ? "joined ExpandiaX" : "updated their map"} · {when}
          </p>
        </div>
      </div>

      <p className="mt-4 font-serif text-2xl leading-snug">
        {isNewMember ? (
          <>
            {first} has been to <span className="text-accent">{n} countries</span>
          </>
        ) : (
          <>
            {first} added <span className="text-accent">{n} countries</span> to their map
          </>
        )}
      </p>

      <ul className="mt-4 grid grid-cols-6 gap-1.5" aria-label="Countries">
        {countries.slice(0, SHOWN).map((c) => {
          const [a, b] = flagGradientColors(c.code);
          return (
            <li
              key={c.code}
              title={c.name}
              className="flex aspect-square items-center justify-center rounded-lg text-2xl shadow-sm sm:text-3xl"
              style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
            >
              <span aria-hidden>{c.flag}</span>
              <span className="sr-only">{c.name}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted">
        {countries.slice(0, 3).map((c) => c.name).join(", ")}
        {n > 3 ? ` and ${n - 3} more` : ""} · <span className="font-medium text-accent">See {first}&rsquo;s map →</span>
      </p>
    </Link>
  );
}
