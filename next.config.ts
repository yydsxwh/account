import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@andyyyds/shared"],
};

export default nextConfig;
