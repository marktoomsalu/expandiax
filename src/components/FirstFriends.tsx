import { createClient } from "@/lib/supabase/server";
import { loadFriendSuggestions } from "@/lib/experienceNetworkData";
import { FirstFriendsSheet } from "./FirstFriendsSheet";

/**
 * Offers "Who's coming with you?" to members following fewer than three
 * people — or to anyone when `force` is set (the feed's "Find friends").
 * Suggestions are only worked out when the sheet could show.
 */
export async function FirstFriends({ userId, force = false }: { userId: string; force?: boolean }) {
  const supabase = createClient();
  const [{ count }, { data: me }] = await Promise.all([
    supabase.from("follows").select("followee_id", { count: "exact", head: true }).eq("follower_id", userId),
    supabase.from("profiles").select("username, display_name").eq("id", userId).single(),
  ]);
  const following = count ?? 0;
  if (!me || (following >= 3 && !force)) return null;
  const suggestions = await loadFriendSuggestions(supabase, userId).catch(() => []);
  if (!suggestions.length && !force) return null;
  return <FirstFriendsSheet suggestions={suggestions} followingCount={following} forceOpen={force} me={me} />;
}
