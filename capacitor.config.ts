import type { CapacitorConfig } from "@capacitor/cli";

// Remote mode: the native shell's WebView loads the live deployment
// directly, since the app is fully server-rendered and can't be bundled
// as a local static build (no Server Actions/edge routes either, so this
// is otherwise a clean fit).
const config: CapacitorConfig = {
  appId: "com.expandiax.app",
  appName: "ExpandiaX",
  webDir: "public",
  server: {
    url: "https://expandiax.com",
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      backgroundColor: "#faf9f6",
      showSpinner: false,
    },
    StatusBar: {
      // "light" -> dark icons/text (StatusBar's naming is inverted: it names
      // the *content* style, not the background), correct for our light
      // (#faf9f6) canvas background below.
      style: "light",
      backgroundColor: "#faf9f6",
      // Reserve space for the status bar instead of drawing under it —
      // without this the WebView renders edge-to-edge and the site's fixed
      // header lands underneath the notch/status bar.
      overlaysWebView: false,
    },
  },
};

export default config;
