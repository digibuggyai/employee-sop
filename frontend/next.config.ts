import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The "N" dev badge (only shows during npm run dev) would cover the sidebar/bottom bar.
  devIndicators: { position: "top-right" },
  // Proxy: the browser calls /api/... on THIS site, Next.js forwards it to the backend.
  // One site from the browser's view → the login cookie is first-party and no CORS is needed.
  async rewrites() {
    const backend = process.env.BACKEND_URL ?? "http://localhost:4000";
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
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
