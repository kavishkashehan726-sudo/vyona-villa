import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  // Trace from the monorepo root so the standalone build includes packages/*.
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
  transpilePackages: ['@vyona/core', '@vyona/db', '@vyona/ui'],
  serverExternalPackages: ['pg'],
  poweredByHeader: false,
};

export default config;
