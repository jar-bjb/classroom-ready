import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "3mb",
    },
    proxyClientMaxBodySize: "3mb",
  },
  turbopack: {
    root: path.resolve("."),
  },
};

export default nextConfig;
