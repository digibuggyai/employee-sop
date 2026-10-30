import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Digibuggy Hub",
    short_name: "Digibuggy",
    description: "Attendance, tasks and leave for the Digibuggy team",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafafa",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/digibuggy-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/digibuggy-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/digibuggy-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
