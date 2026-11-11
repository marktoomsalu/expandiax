import { getAuthUser } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";

/** The signed-in admin's id, or null if they aren't one (the admins table, migration 055). */
export async function adminId(): Promise<string | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const { data } = await createAdminClient().from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  return data ? user.id : null;
}
