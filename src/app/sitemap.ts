import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("username, updated_at")
    .eq("visibility", "public");

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: "https://expandiax.com", changeFrequency: "weekly", priority: 1 },
    { url: "https://expandiax.com/explore", changeFrequency: "daily", priority: 0.8 },
    { url: "https://expandiax.com/sign-up", changeFrequency: "monthly", priority: 0.5 },
    { url: "https://expandiax.com/terms", changeFrequency: "yearly", priority: 0.2 },
    { url: "https://expandiax.com/privacy", changeFrequency: "yearly", priority: 0.2 },
  ];

  const profileRoutes: MetadataRoute.Sitemap = (profiles ?? []).map((p) => ({
    url: `https://expandiax.com/u/${p.username}`,
    lastModified: p.updated_at,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...profileRoutes];
}
