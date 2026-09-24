import type { NextConfig } from "next";
import { environment } from "./src/config/environment";

const nextConfig: NextConfig = {
  experimental: {
    cpus: 1,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${environment.apiUrl}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${environment.apiUrl}/uploads/:path*`,
      },
      {
        source: "/certificates/:path*",
        destination: `${environment.apiUrl}/certificates/:path*`,
      },
    ];
  },
};

export default nextConfig;
