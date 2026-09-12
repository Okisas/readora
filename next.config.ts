import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
  },
  serverExternalPackages: ["@sparticuz/chromium"],
  outputFileTracingIncludes: {
    "/api/fetch-manga": [
      "./node_modules/@sparticuz/chromium/bin/**/*",
    ],
    "/api/fetch-text": [
      "./node_modules/@sparticuz/chromium/bin/**/*",
    ],
  },
};

export default nextConfig;
