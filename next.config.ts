import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // In dev, proxy /api/v1/* to Django so the app works without NEXT_PUBLIC_API_BASE
    if (process.env.NODE_ENV === "development") {
      return [
        {
          source: "/api/v1/:path*",
          destination: "http://localhost:8000/api/v1/:path*",
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
