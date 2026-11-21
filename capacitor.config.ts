import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize } from "@capacitor/keyboard";

// Remote mode: the native shell's WebView loads the live deployment
// directly, since the app is fully server-rendered and can't be bundled
// as a local static build (no Server Actions/edge routes either, so this
// is otherwise a clean fit).
const config: CapacitorConfig = {
  appId: "com.expandiax.travelapp",
  appName: "ExpandiaX",
  webDir: "public",
  // Lets the server tell the app's WebView apart from a normal browser
  // (e.g. to hide web checkout links inside the app) — must match
  // NATIVE_APP_UA_MARKER in src/lib/nativeApp.ts. Baked into the native
  // build, so it takes effect from the next app build.
  appendUserAgent: "ExpandiaXApp",
  server: {
    url: "https://expandiax.com",
    cleartext: false,
    // Shown (from the app itself) when expandiax.com can't be reached,
    // instead of the system's bare "Webpage not available".
    errorPath: "offline.html",
  },
  plugins: {
    SplashScreen: {
      // The website lets it go once the first screen is ready (NativeSplash,
      // src/lib/splash.ts); this is only the backstop if that never comes.
      launchShowDuration: 10000,
      launchAutoHide: true,
      launchFadeOutDuration: 350,
      backgroundColor: "#2b0b2e",
      showSpinner: false,
    },
    StatusBar: {
      // Brand purple with light icons from the first moment, behind the
      // Dynamic Island on the launch screen too, matching the header the
      // website sets once it's loaded (NativeStatusBar). "DARK" names the
      // content style for a dark background (light icons).
      style: "DARK",
      backgroundColor: "#2B0B2E",
      // Reserve space for the status bar instead of drawing under it —
      // without this the WebView renders edge-to-edge and the site's fixed
      // header lands underneath the notch/status bar.
      overlaysWebView: false,
    },
    Keyboard: {
      // Resize the whole WebView (not just the body) when the keyboard
      // shows, so fixed-position elements like the bottom tab bar behave
      // correctly instead of getting hidden behind the keyboard.
      resize: KeyboardResize.Native,
    },
  },
};

export default config;
