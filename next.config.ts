import type { NextConfig } from "next";

// Content Security Policy — permissive `script-src` because react-three-fiber
// and Next.js dev overlays rely on inline/`eval` scripts; `frame-src` is
// narrowly scoped to the two embed origins we actually render (YouTube +
// Spotify per SPEC-SPOTIFY-001 T-013). Avoid broadening `frame-src`
// without updating the SPEC — it's the main CSRF/clickjacking boundary
// we still have.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https: blob:",
  "font-src 'self' data:",
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://open.spotify.com",
  "connect-src 'self' https://api.spotify.com https://accounts.spotify.com https://*.supabase.co",
  "media-src 'self' https:",
].join('; ');

const nextConfig: NextConfig = {
  transpilePackages: ['three'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [{ key: 'Content-Security-Policy', value: csp }],
      },
    ];
  },
};

export default nextConfig;
