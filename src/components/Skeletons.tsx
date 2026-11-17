import { cn } from "@/lib/utils";

// What a page looks like while it's on its way (each route's loading.tsx):
// shown the instant something is tapped, so nothing feels stuck. Shapes
// only, in the page's own layout, gently pulsing.

const Block = ({ className }: { className?: string }) => <div aria-hidden className={cn("animate-pulse rounded-2xl bg-raised", className)} />;

function Wrap({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div role="status" aria-label="Loading" className={cn("mx-auto px-5 py-8", wide ? "max-w-shell" : "max-w-3xl")}>
      {children}
    </div>
  );
}

/** Any page: a heading and a few cards. */
export function PageSkeleton() {
  return (
    <Wrap wide>
      <Block className="h-4 w-24 rounded-full" />
      <Block className="mt-3 h-9 w-2/3 max-w-sm" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Block key={i} className="h-40" />
        ))}
      </div>
    </Wrap>
  );
}

/** The feed: posts, each a big picture with a line under it. */
export function FeedSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="mx-auto max-w-2xl space-y-6 px-0 py-6 sm:px-5">
      {[0, 1].map((i) => (
        <div key={i} className="overflow-hidden rounded-none border-y border-line bg-surface sm:rounded-2xl sm:border">
          <Block className="aspect-[4/5] rounded-none sm:aspect-square" />
          <div className="flex items-center gap-4 px-4 py-3">
            <Block className="h-5 w-16 rounded-full" />
            <Block className="h-5 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A trip, stay or event: the big picture at the top, then its parts. */
export function TripSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <div className="relative h-[56vh] max-h-[520px] min-h-[360px] w-full animate-pulse bg-[#2b0b2e]">
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-3xl space-y-3 px-5 pb-6">
          <div className="h-3 w-28 rounded-full bg-white/15" />
          <div className="h-10 w-3/4 rounded-xl bg-white/20" />
          <div className="h-4 w-1/2 rounded-full bg-white/15" />
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-5 pt-6">
        <Block className="h-20" />
        <Block className="mt-8 h-7 w-48" />
        <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Block key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Someone's profile: picture and name, numbers, then their posts. */
export function ProfileSkeleton() {
  return (
    <Wrap wide>
      <div className="flex items-center gap-4">
        <Block className="h-20 w-20 rounded-full" />
        <div className="flex-1 space-y-2">
          <Block className="h-7 w-48" />
          <Block className="h-4 w-32 rounded-full" />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <Block key={i} className="h-16" />
        ))}
      </div>
      <Block className="mt-6 h-64" />
    </Wrap>
  );
}

/** A list (Notifications): rows with a picture and two lines. */
export function ListSkeleton() {
  return (
    <Wrap>
      <Block className="h-9 w-48" />
      <ul className="mt-6 space-y-5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <li key={i} className="flex items-center gap-3">
            <Block className="h-10 w-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Block className="h-4 w-4/5 rounded-full" />
              <Block className="h-3 w-16 rounded-full" />
            </div>
          </li>
        ))}
      </ul>
    </Wrap>
  );
}
