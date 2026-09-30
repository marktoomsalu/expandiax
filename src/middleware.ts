import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isNativeUserAgent } from "@/lib/nativeApp";

const PROTECTED = ["/my-world", "/events", "/stats", "/settings", "/onboarding", "/feed", "/together", "/reset-password", "/notifications"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Checked from the session's signed token (and refreshed when it's about to
  // expire) — with asymmetric JWT signing keys that's no round trip to Supabase
  // on every page and navigation. This only decides redirects; the database's
  // own rules still check the token on every query.
  const { data: claims } = await supabase.auth.getClaims();
  const user = claims?.claims?.sub ? { id: claims.claims.sub } : null;

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED.some((p) => path === p || path.startsWith(p + "/"));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // First open of the app (logged out, WebView on "/") goes straight to
  // onboarding — on the server, so the marketing homepage and its pricing
  // never render inside the app, not even for a frame.
  if (!user && path === "/" && isNativeUserAgent(request.headers.get("user-agent"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/start";
    return NextResponse.redirect(url);
  }

  if (user && (path === "/sign-in" || path === "/sign-up" || path === "/" || path === "/start")) {
    const url = request.nextUrl.clone();
    url.pathname = path === "/" ? "/feed" : "/my-world";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|data/|maplibre/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
