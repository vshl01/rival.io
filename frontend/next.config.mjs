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
};

export default nextConfig;
