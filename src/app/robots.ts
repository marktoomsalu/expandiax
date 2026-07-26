import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/my-world", "/events", "/stats", "/settings", "/onboarding", "/feed", "/notifications", "/reset-password", "/api/"],
    },
    sitemap: "https://expandiax.com/sitemap.xml",
  };
}
