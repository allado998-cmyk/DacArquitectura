import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Descàrregues cron draws the DAC logo into its PDFs.
  outputFileTracingIncludes: { "/api/cron/descarregues": ["./public/logo.jpg"] },
  experimental: {
    // Actes photos / PDF attachments are uploaded through server actions as
    // base64 — allow large payloads (effectively no practical size limit).
    serverActions: { bodySizeLimit: "200mb" },
  },
};

export default nextConfig;
