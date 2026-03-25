import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
  },
  transpilePackages: ["@ai-sdk/google"],
};

export default nextConfig;