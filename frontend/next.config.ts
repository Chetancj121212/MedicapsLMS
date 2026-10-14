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
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com https://static.cloudflareinsights.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https:",
              "img-src 'self' data: https: blob: https://i.ytimg.com https://*.ytimg.com",
              "font-src 'self' data: https: https://fonts.gstatic.com",
              "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://drive.google.com",
              "connect-src 'self' https: http: ws: wss: https://www.youtube.com https://*.youtube.com https://cloudflareinsights.com https://static.cloudflareinsights.com",
              "media-src 'self' data: blob: https: http:",
              "worker-src 'self' blob:",
              "child-src 'self' blob: https://www.youtube.com https://www.youtube-nocookie.com https://drive.google.com",
            ].join("; ") + ";",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
