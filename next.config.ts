// Next.js configuration
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typedRoutes: true,
  devIndicators: false,
  serverExternalPackages: ["exceljs"],
};

export default nextConfig;
