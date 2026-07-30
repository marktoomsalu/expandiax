import { NextResponse } from "next/server";

// Universal Links: lets iOS open https://expandiax.com/auth/callback (email
// confirmation, password reset) directly in the app instead of Safari, once
// the Associated Domains capability is added in Xcode (blocked on a paid
// Apple Developer Program membership — the capability isn't offered to free
// Personal Team accounts). No file extension is intentional — this is
// Apple's required path and format.
export async function GET() {
  return NextResponse.json({
    applinks: {
      apps: [],
      details: [
        {
          appID: "4AAMQQWSPW.com.expandiax.app",
          paths: ["/auth/callback*"],
        },
      ],
    },
  });
}
