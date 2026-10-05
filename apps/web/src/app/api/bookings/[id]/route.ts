import { releaseHold } from '@vyona/core';

// The guest stepped back from the review: give the nights back straight away
// instead of waiting for the hold to run out.
export async function DELETE(_req: Request, ctx: RouteContext<'/api/bookings/[id]'>) {
  const { id } = await ctx.params;
  await releaseHold(id);
  return new Response(null, { status: 204 });
}
