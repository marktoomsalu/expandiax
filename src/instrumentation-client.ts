import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.2,
  // No-ops safely when NEXT_PUBLIC_SENTRY_DSN is unset (e.g. local dev).
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
