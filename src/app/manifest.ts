import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ExpandiaX",
    short_name: "ExpandiaX",
    description: "Your world, remembered — countries visited and events you never want to forget.",
    start_url: "/my-world",
    display: "standalone",
    background_color: "#faf9f6",
    theme_color: "#ff6347",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
