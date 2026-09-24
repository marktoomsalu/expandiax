import { notFound } from "next/navigation";
import { PhoneScreen } from "@/components/appstore/PhoneScreen";
import { CreateScreen, EventScreen, FeedScreen, ThenScreen, WorldScreen } from "@/components/appstore/screens";

// Dev-only: phone screens for the App Store screenshot set, captured by
// scripts/appstore-screenshots.mjs. Never served in production.
export const dynamic = "force-dynamic";

const SCREENS = {
  feed: { tab: "feed", Screen: FeedScreen },
  world: { tab: "world", Screen: WorldScreen },
  event: { tab: "events", Screen: EventScreen },
  then: { tab: "feed", Screen: ThenScreen },
  create: { tab: null, Screen: CreateScreen },
} as const;

export default function AppStoreScreen({ params }: { params: { slug: string } }) {
  if (process.env.NODE_ENV === "production") notFound();
  const entry = SCREENS[params.slug as keyof typeof SCREENS];
  if (!entry) notFound();
  const { tab, Screen } = entry;
  return (
    <PhoneScreen tab={tab}>
      <Screen />
    </PhoneScreen>
  );
}
