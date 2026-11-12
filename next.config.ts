import type { NextConfig } from "next";

// NEXORA is almost entirely per-user, live data (guest stays, staff tasks, the
// manager's request board), so it uses Next.js's classic dynamic rendering.
// Cache Components is left off on purpose; see README "Architecture notes".
const nextConfig: NextConfig = {
  // Dev only: lets a second staff role run on http://127.0.0.1:<port> in the same
  // browser (a different host = a separate sign-in), next to localhost.
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    // Pin the workspace root to this repo (a stray lockfile higher up confuses detection).
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
