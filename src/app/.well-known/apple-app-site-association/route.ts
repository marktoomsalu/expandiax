import { NextResponse } from "next/server";

// Universal Links: lets iOS open https://expandiax.com/auth/callback (email
// confirmation, password reset) directly in the app instead of Safari, once
// the Associated Domains capability is added in Xcode. No file extension is
// intentional — this is Apple's required path and format.
//
// TODO: replace <TEAM_ID> once the app has an Apple Developer Team ID
// (Xcode -> App target -> Signing & Capabilities -> Team).
export async function GET() {
  return NextResponse.json({
    applinks: {
      apps: [],
      details: [
        {
          appID: "<TEAM_ID>.com.expandiax.app",
          paths: ["/auth/callback*"],
        },
      ],
    },
  });
}
