import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        // Every uploaded image — menu photos, staff portraits, branch shots,
        // QR codes — comes from Supabase Storage.
        hostname: "dfcebvjkwnwfsfpuckkj.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;