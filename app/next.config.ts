import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; Next transpiles them into the
  // app bundle (types resolve through each package's `exports` field).
  transpilePackages: ["@odyssey/practice-engine"],
};

export default nextConfig;
