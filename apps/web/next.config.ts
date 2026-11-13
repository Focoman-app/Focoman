import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NODE_ENV === "production" ? ".next" : ".next-dev",
  serverExternalPackages: ["firebase-admin"],
  outputFileTracingIncludes: { '/api/billing/*/pdf': ['./src/lib/billing/fonts/**/*'] },
  transpilePackages: [
    "@focoman/db",
    "@focoman/auth",
    "@focoman/types",
    "@focoman/validation",
    "@focoman/domain",
    "@focoman/config",
    "@focoman/entitlements",
  ],
  eslint: {
    // Run eslint separately via npm run lint to avoid OOM crashes during build on Cloud Run
    ignoreDuringBuilds: true,
  },
  poweredByHeader: false,
  compress: true,
  async redirects() {
    return [
      {
        source: "/features",
        destination: "/#modules",
        permanent: true,
      },
      {
        source: "/pricing",
        destination: "/#pricing",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/__/auth/:path*",
        destination: "https://focoman.firebaseapp.com/__/auth/:path*",
      },
    ];
  },
};

export default nextConfig;
