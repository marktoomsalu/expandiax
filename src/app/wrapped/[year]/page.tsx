import { notFound, redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { adminId } from "@/lib/adminAuth";
import { loadWrapped } from "@/lib/wrappedLoad";
import { wrappedOpenFor } from "@/lib/wrapped";
import { WrappedPlayer } from "@/components/wrapped/WrappedPlayer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your year · ExpandiaX Wrapped" };

/** ExpandiaX Year Wrapped. Admins only until it opens (WRAPPED_OPEN, and then from December). */
export default async function WrappedPage({ params }: { params: { year: string } }) {
  const user = await getAuthUser();
  if (!user) redirect(`/sign-in?next=/wrapped/${params.year}`);
  const year = Number(params.year);
  if (!Number.isInteger(year) || year < 2000 || year > new Date().getFullYear()) notFound();
  if (!wrappedOpenFor(year) && !(await adminId())) notFound();
  const w = await loadWrapped(createClient(), user.id, year);
  return <WrappedPlayer w={w} />;
}
