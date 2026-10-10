import type { NextConfig } from "next";
import { environment } from "./src/config/environment";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    const internalApiUrl = process.env.INTERNAL_API_URL || environment.apiUrl;

    return [
      {
        source: "/api/:path*",
        destination: `${internalApiUrl}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${internalApiUrl}/uploads/:path*`,
      },
      {
        source: "/certificates/:path*",
        destination: `${internalApiUrl}/certificates/:path*`,
      },
    ];
  },
};

export default nextConfig;
