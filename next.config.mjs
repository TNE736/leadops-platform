/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The AG-UI Gateway (Event Adapter / State Manager / Session Manager) is
  // expected to run as a separate service. In dev, proxy /api/ag-ui/* to it
  // so the browser can open SSE/WebSocket connections same-origin.
  async rewrites() {
    return [
      {
        source: '/api/ag-ui/:path*',
        destination: `${process.env.LIVE_UPDATES_GATEWAY_URL || 'http://localhost:4000'}/:path*`,
      },
    ];
  },
};

export default nextConfig;
