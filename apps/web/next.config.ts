import type { NextConfig } from "next";
import { resolve } from "path";

const nextConfig: NextConfig = {
  transpilePackages: ["@cddai/shared"],
  webpack: (config) => {
    // Ensure shared package changes trigger hot reload
    config.watchOptions = {
      ...config.watchOptions,
      ignored: /node_modules\/(?!@cddai)/,
    };
    return config;
  },
};

export default nextConfig;
