import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The "N" dev badge (only shows during npm run dev) would cover the sidebar/bottom bar.
  devIndicators: { position: "top-right" },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
