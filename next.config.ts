import type { NextConfig } from "next";
// Static export for Firebase Hosting (free Spark plan): no Node server runs.
// Security headers are set in firebase.json because static hosting ignores headers().
const config: NextConfig = {
  output: "export",
  poweredByHeader: false,
  images: { unoptimized: true },
};
export default config;
