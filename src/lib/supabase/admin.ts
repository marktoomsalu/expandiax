import { createClient } from "@supabase/supabase-js";

/**
 * Bypasses RLS entirely via the service-role key. Server-only, and only for
 * the Stripe webhook — it writes billing status outside of any user's
 * session, which no anon-key client can do (by design: regular users have
 * no insert/update policy on `billing`).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin client is not configured.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
