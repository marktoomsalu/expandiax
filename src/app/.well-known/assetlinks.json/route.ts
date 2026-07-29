import { NextResponse } from "next/server";

// App Links: lets Android open https://expandiax.com/auth/callback (email
// confirmation, password reset) directly in the app instead of the browser.
//
// TODO: add the app's signing certificate SHA-256 fingerprint(s) once known
// (debug: `keytool -list -v -keystore ~/.android/debug.keystore -alias
// androiddebugkey -storepass android` after the first Android build; release:
// from Play Console once the app is signed for production). An empty list
// just means App Links verification fails and links fall back to opening in
// the browser — nothing breaks in the meantime.
export async function GET() {
  return NextResponse.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.expandiax.app",
        sha256_cert_fingerprints: [] as string[],
      },
    },
  ]);
}
