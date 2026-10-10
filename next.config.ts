import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fotos y logos de hasta 2 MB viajan en el formulario de la Server Action.
  experimental: { serverActions: { bodySizeLimit: '3mb' } },
  /* config options here */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
