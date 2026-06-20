import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.akamai.steamstatic.com',
      },
      {
        protocol: 'https',
        hostname: 'media.steampowered.com',
      },
    ],
  },
  // better-sqlite3 is a native module — keep it server-side only
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
