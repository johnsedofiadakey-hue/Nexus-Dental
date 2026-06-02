import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg", "ioredis", "bcryptjs"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
