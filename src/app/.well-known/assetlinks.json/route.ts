import { NextResponse } from "next/server";

// App Links: lets Android open https://expandiax.com/auth/callback (email
// confirmation, password reset) directly in the app instead of the browser.
//
// The certificates whose builds may claim expandiax.com links: the upload key
// (android/expandiax-upload.jks, for builds installed straight from it) —
// TODO: plus Google Play's app signing key from Play Console → Test and
// release → App integrity, once the first build is uploaded. Until then,
// links from Play installs just open in the browser — nothing breaks.
export async function GET() {
  return NextResponse.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.expandiax.travelapp",
        sha256_cert_fingerprints: [
          // Upload key
          "EC:47:F5:BB:0C:08:64:FF:07:3B:44:A1:EC:F6:9B:61:BF:C6:A8:98:28:C3:16:EA:23:F8:53:E6:5A:D3:7D:04",
        ],
      },
    },
  ]);
}
