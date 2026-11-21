"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
    // The app's launch screen waits for a page; this one replaces the layout that would let it go.
    void import("@capacitor/splash-screen").then(({ SplashScreen }) => SplashScreen.hide().catch(() => {}));
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{ maxWidth: 420, margin: "6rem auto", padding: "0 20px", textAlign: "center", fontFamily: "sans-serif" }}>
          <h1 style={{ fontSize: 28 }}>Something went wrong.</h1>
          <p style={{ color: "#666", marginTop: 8 }}>We&rsquo;ve been notified. Try reloading the page.</p>
        </div>
      </body>
    </html>
  );
}
