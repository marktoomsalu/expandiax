import { notFound } from "next/navigation";
import { PhoneScreen } from "@/components/appstore/PhoneScreen";
import { ChatScreen, CreateScreen, EventScreen, FeedScreen, ThenScreen, WorldScreen } from "@/components/appstore/screens";

// Dev-only: phone screens for the App Store screenshot set, captured by
// scripts/appstore-screenshots.mjs. Never served in production.
export const dynamic = "force-dynamic";

const SCREENS = {
  feed: { tab: "feed", Screen: FeedScreen },
  world: { tab: "world", Screen: WorldScreen },
  event: { tab: "events", Screen: EventScreen },
  then: { tab: "feed", Screen: ThenScreen },
  create: { tab: null, Screen: CreateScreen },
  chat: { tab: "feed", Screen: ChatScreen },
} as const;

export default function AppStoreScreen({ params, searchParams }: { params: { slug: string }; searchParams: { os?: string } }) {
  if (process.env.NODE_ENV === "production") notFound();
  const entry = SCREENS[params.slug as keyof typeof SCREENS];
  if (!entry) notFound();
  const { tab, Screen } = entry;
  return (
    // The chat bubble shows as in the app, except where the chat itself is open, or on the add form.
    <PhoneScreen tab={tab} os={searchParams.os === "android" ? "android" : "ios"} chat={params.slug !== "chat" && params.slug !== "create"}>
      <Screen />
    </PhoneScreen>
  );
}
