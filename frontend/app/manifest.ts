import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Makes "Add to Home Screen" open a standalone app, which iOS requires for Web Push. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CSSA Hub",
    short_name: "CSSA Hub",
    description: "UCSB CSSA internal platform",
    id: `${base}/`,
    start_url: `${base}/chat/`,
    scope: `${base}/`,
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: `${base}/brand/icon-192.png`, sizes: "192x192", type: "image/png" },
      { src: `${base}/brand/icon-512.png`, sizes: "512x512", type: "image/png" },
    ],
  };
}
