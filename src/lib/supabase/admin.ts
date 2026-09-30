import { createClient } from "@supabase/supabase-js";

/**
 * Bypasses RLS entirely via the service-role key. Server-only, for the few
 * jobs no signed-in session can do: signing private media links for rows the
 * viewer's own session already fetched, scheduled jobs, and push delivery.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin client is not configured.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
