import { NextResponse } from "next/server";

// Universal Links: lets iOS open https://expandiax.com/auth/callback (email
// confirmation, password reset) directly in the app instead of Safari. No
// file extension is intentional — this is Apple's required path and format.
export async function GET() {
  return NextResponse.json({
    applinks: {
      apps: [],
      details: [
        {
          appID: "4AAMQQWSPW.com.expandiax.travelapp",
          paths: ["/auth/callback*"],
        },
      ],
    },
  });
}
