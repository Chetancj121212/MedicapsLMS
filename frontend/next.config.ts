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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data: https:; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; connect-src 'self' https: http:; media-src 'self' data: blob:;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
