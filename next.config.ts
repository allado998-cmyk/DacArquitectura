import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Descàrregues cron draws the DAC logo into its PDFs; Càlculs › Normatives
  // serves its PDFs from normatives/ (not public/: only to signed-in users).
  outputFileTracingIncludes: {
    "/api/cron/descarregues": ["./public/logo.jpg"],
    "/calculs/normatives/*": ["./normatives/*.pdf"],
  },
  experimental: {
    // Actes photos / PDF attachments are uploaded through server actions as
    // base64 — allow large payloads (effectively no practical size limit).
    serverActions: { bodySizeLimit: "200mb" },
  },
};

export default nextConfig;
