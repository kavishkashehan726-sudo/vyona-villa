import path from 'node:path';
import type { NextConfig } from 'next';

// Photo uploads go through a server action: allow a full-size phone photo
// (the proxy buffers request bodies too, so it gets the same limit).
const UPLOAD_LIMIT = '16mb';

const config: NextConfig = {
  output: 'standalone',
  // Trace from the monorepo root so the standalone build includes packages/*.
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
  transpilePackages: ['@vyona/core', '@vyona/db', '@vyona/ui'],
  serverExternalPackages: ['pg', 'sharp'],
  poweredByHeader: false,
  experimental: {
    serverActions: { bodySizeLimit: UPLOAD_LIMIT },
    proxyClientMaxBodySize: UPLOAD_LIMIT,
  },
};

export default config;
