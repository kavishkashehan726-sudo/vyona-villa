import { prisma } from '@vyona/db';

export const dynamic = 'force-dynamic';

// Used by Docker healthchecks and the deploy script.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, db: 'unreachable' }, { status: 503 });
  }
}
