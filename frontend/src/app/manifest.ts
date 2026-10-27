import type { MetadataRoute } from "next";

// The web app manifest: lets phones install Digibuggy Hub to the home screen.
// It then opens full-screen like a native app ("standalone"), with our name, colour and icon.
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
      // "maskable": Android may crop it into a circle/squircle; the navy square fills it, the bee stays inside the safe zone
      { src: "/icons/digibuggy-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
