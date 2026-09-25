import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: let the ngrok tunnel (used to receive Square webhooks locally)
  // load dev assets; without it every client-rendered page is blank.
  allowedDevOrigins: ["*.ngrok-free.dev", "*.ngrok-free.app"],
};

export default nextConfig;
