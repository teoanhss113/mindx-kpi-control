import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // allowedDevOrigins là top-level key (không phải experimental)
  // Wildcard *.ngrok-free.app được hỗ trợ theo docs chính thức Next.js 16
  allowedDevOrigins: ['*.ngrok-free.dev'],
  turbopack: {},
};

export default nextConfig;
