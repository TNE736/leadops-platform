/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // /api/logs imports lib/frontend_logging for its renderer; keep the OpenTelemetry
  // instrumentation package out of the server bundle (it loads Node's require hooks).
  experimental: { serverComponentsExternalPackages: ['@opentelemetry/instrumentation'] },
};

export default nextConfig;
