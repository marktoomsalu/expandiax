import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co", pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
};

// No-ops safely when NEXT_PUBLIC_SENTRY_DSN is unset — no org/project needed
// until you're ready to also enable source-map upload.
export default withSentryConfig(nextConfig, {
  silent: true,
});
