import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component; middleware refreshes sessions.
          }
        },
      },
      global: {
        fetch: (url, options = {}) => fetch(url, { ...options, cache: "no-store" }),
      },
    }
  );
}

// Who's signed in, checked from the session's signed token (getClaims). With
// the project's asymmetric JWT signing keys that's verified right here — no
// round trip to Supabase before a page can start on its data; with the older
// shared secret it falls back to asking Supabase, as getUser() always did.
// cache() dedupes repeat calls within a single request/render pass to one.
// Pages only use the id and email; the database's own rules still check the
// token on every query.
export const getAuthUser = cache(async (): Promise<User | null> => {
  const supabase = createClient();
  const { data } = await supabase.auth.getClaims();
  const c = data?.claims;
  if (!c?.sub) return null;
  return {
    id: c.sub,
    email: c.email ?? undefined,
    app_metadata: c.app_metadata ?? {},
    user_metadata: c.user_metadata ?? {},
    aud: String(c.aud ?? "authenticated"),
    created_at: "",
  } as User;
});
