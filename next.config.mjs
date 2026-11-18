import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // A page seen in the last minute (and one fetched ahead by the tab bar,
    // for five) shows again at once instead of waiting on the server. Anything
    // changed refreshes as before (router.refresh()).
    staleTimes: { dynamic: 60, static: 300 },
  },
  images: {
    // An optimised photo stays cached for 12 hours, as long as its link stays
    // the same (src/lib/signedMedia.ts), instead of being made again every minute.
    minimumCacheTTL: 43200,
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co", pathname: "/storage/v1/object/public/**" },
      // Memories are private: pages get short-lived signed links (src/lib/signedMedia.ts).
      { protocol: "https", hostname: "**.supabase.co", pathname: "/storage/v1/object/sign/**" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "i.scdn.co" },
      { protocol: "https", hostname: "**.mzstatic.com" },
    ],
  },
  async redirects() {
    return [
      { source: "/concerts", destination: "/events", permanent: true },
      { source: "/concerts/:path*", destination: "/events/:path*", permanent: true },
      { source: "/u/:username/concerts/:id", destination: "/u/:username/events/:id", permanent: true },
    ];
  },
};

// No-ops safely when NEXT_PUBLIC_SENTRY_DSN is unset — no org/project needed
// until you're ready to also enable source-map upload.
export default withSentryConfig(nextConfig, {
  silent: true,
});
