import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toDeepLTargetLang, translateTexts } from "@/lib/translate";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const texts: unknown = body?.texts;
  const targetLang: unknown = body?.targetLang;
  if (!Array.isArray(texts) || texts.some((t) => typeof t !== "string") || typeof targetLang !== "string") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  // DeepL rejects empty strings — translate only the non-empty ones and
  // splice empties back in by position so the response array stays aligned.
  const nonEmpty = texts.map((t, i) => [i, t] as const).filter(([, t]) => t.trim().length > 0);
  if (nonEmpty.length === 0) return NextResponse.json({ translations: texts });

  try {
    const translated = await translateTexts(
      nonEmpty.map(([, t]) => t),
      toDeepLTargetLang(targetLang)
    );
    const translations = [...texts];
    nonEmpty.forEach(([i], idx) => {
      translations[i] = translated[idx];
    });
    return NextResponse.json({ translations });
  } catch (e) {
    const message = e instanceof Error && e.message === "not_configured" ? "Translation isn't set up yet." : "Could not translate this right now.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
