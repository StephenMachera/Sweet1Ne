import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    // Next serves public/ with max-age=0, so a returning visitor's browser
    // re-asks the server about every film before it will play one. A day
    // fresh, then stale-while-revalidate: return visits start from cache at
    // once, and a replaced file (same name — the templates fix the names)
    // shows up on the next visit after that.
    const cached = "public, max-age=86400, stale-while-revalidate=604800";

    return [
      { source: "/videos/:path*", headers: [{ key: "Cache-Control", value: cached }] },
      { source: "/images/:path*", headers: [{ key: "Cache-Control", value: cached }] },
    ];
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        // Every uploaded image — menu photos, staff portraits, branch shots,
        // QR codes — comes from Supabase Storage. Wildcarded rather than
        // one project's hostname, since local dev points at its own
        // separate Supabase project (a different subdomain) — hardcoding
        // just production's here silently 500s next/image everywhere a
        // real photo renders in dev.
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;