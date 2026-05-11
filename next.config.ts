import type { NextConfig } from "next";

const allowedDevOrigins =
  process.env.NODE_ENV === 'development' && process.env.NGROK_URL
    ? [process.env.NGROK_URL]
    : [];

const nextConfig: NextConfig = {
  allowedDevOrigins,
  turbopack: {},
};

export default nextConfig;
