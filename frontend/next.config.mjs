/** @type {import('next').NextConfig} */
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      // Allow images served by the API (uploaded attachments) in production.
      ...(() => {
        try {
          const u = new URL(apiUrl);
          return [{ protocol: u.protocol.replace(':', ''), hostname: u.hostname }];
        } catch {
          return [];
        }
      })(),
    ],
  },
  // CSP itself is set per-request in src/middleware.ts (it needs a fresh nonce).
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
