import { NextRequest, NextResponse } from "next/server";
import { adminId } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** A placement's picture, into the public partner-media bucket; answers with its address. Admins only. */
export async function POST(request: NextRequest) {
  if (!(await adminId())) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No picture came through." }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Use a JPEG, PNG or WebP picture." }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Pictures can be up to 5 MB." }, { status: 400 });
  const admin = createAdminClient();
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await admin.storage.from("partner-media").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) return NextResponse.json({ error: "Couldn't upload it. Try again." }, { status: 500 });
  return NextResponse.json({ url: admin.storage.from("partner-media").getPublicUrl(path).data.publicUrl });
}
