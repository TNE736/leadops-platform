import { existsSync, readFileSync } from 'node:fs';

// One .env for the whole repo. Next.js only reads .env files in its own folder (frontend/), so
// load the repo-root .env here, parsed like load_repo_env() in backend/integrations/main.py:
// KEY=value lines, # comments, optional quotes. Variables already set in the shell win.
const repoEnvFile = new URL('../.env', import.meta.url);
if (existsSync(repoEnvFile)) {
  for (const rawLine of readFileSync(repoEnvFile, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    const separator = line.indexOf('=');
    if (!line || line.startsWith('#') || separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^"+|"+$/g, '')
      .replace(/^'+|'+$/g, '');
    process.env[key] ??= value;
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // /api/logs imports lib/frontend_logging for its renderer; keep the OpenTelemetry
  // instrumentation package out of the server bundle (it loads Node's require hooks).
  experimental: { serverComponentsExternalPackages: ['@opentelemetry/instrumentation'] },
};

export default nextConfig;
