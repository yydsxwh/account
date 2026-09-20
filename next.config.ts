import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@andyyyds/shared"],
  async rewrites() {
    // App Router 不会把以点开头的目录当成路由，
    // 所以 OIDC 规定的 /.well-known/* 用 rewrite 指到真实的 /api/oidc/*
    return [
      {
        source: "/.well-known/openid-configuration",
        destination: "/api/oidc/openid-configuration",
      },
      {
        source: "/.well-known/jwks.json",
        destination: "/api/oidc/jwks",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // 发现文档和 JWKS 要让各产品的服务端能跨域读到
        source: "/.well-known/:path*",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
    ];
  },
};

export default nextConfig;
