import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Actes photos / PDF attachments are uploaded through server actions as
    // base64 — allow large payloads (effectively no practical size limit).
    serverActions: { bodySizeLimit: "200mb" },
  },
};

export default nextConfig;
