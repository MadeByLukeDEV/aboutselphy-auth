import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Thin service on a resource-constrained VPS: the standalone output ships
  // only the traced dependencies instead of the full node_modules.
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
