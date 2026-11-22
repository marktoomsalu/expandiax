import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { createShareToken, revokeShareToken } from "@/lib/shareTokens";

export const dynamic = "force-dynamic";

/** The iPhone app, signed in: a share key for its Share button (kept in the phone's keychain). */
export async function POST() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    return NextResponse.json({ token: await createShareToken(user.id), userId: user.id });
  } catch {
    return NextResponse.json({ error: "Couldn't set up sharing." }, { status: 500 });
  }
}

/** Signing out: this phone's share key stops working. */
export async function DELETE(request: NextRequest) {
  await revokeShareToken(request).catch(() => {});
  return NextResponse.json({ ok: true });
}
