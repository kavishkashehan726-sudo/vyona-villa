// Background worker: everything that must not block a guest's request.
// Web and admin add the jobs; Beds24 handlers arrive in build step 6.

import { JOB, QUEUE, createRedis, expireHolds, queue } from '@vyona/core';
import { prisma } from '@vyona/db';
import { Worker, type Job } from 'bullmq';
import { sendGuestCancellation, sendGuestConfirmation, sendOwnerBooking, sendOwnerRefund } from './mail';

type Data = { reservationId: string; orderId: string };

const handlers: Record<string, (data: Data) => Promise<unknown>> = {
  [JOB.expireHolds]: async () => {
    const n = await expireHolds();
    return n ? `expired ${n} hold${n === 1 ? '' : 's'}` : 'nothing to expire';
  },
  [JOB.guestConfirmation]: (d) => sendGuestConfirmation(d.reservationId),
  [JOB.guestCancellation]: (d) => sendGuestCancellation(d.reservationId),
  [JOB.ownerBooking]: (d) => sendOwnerBooking(d.reservationId),
  [JOB.ownerRefund]: (d) => sendOwnerRefund(d.reservationId, d.orderId),
};

async function handle(job: Job<Data>) {
  const run = handlers[job.name];
  if (!run) {
    console.log(`[${job.queueName}] ${job.name} #${job.id} — no handler yet`, job.data);
    return;
  }
  const result = await run(job.data);
  // The sweep runs every minute; only log it when it did something.
  if (job.name !== JOB.expireHolds || result !== 'nothing to expire') {
    console.log(`[${job.queueName}] ${job.name} #${job.id}: ${result}`);
  }
  return result;
}

const workers = Object.values(QUEUE).map(
  (name) =>
    new Worker(name, handle, { connection: createRedis(), concurrency: 4 })
      .on('failed', (job, err) => console.error(`[${name}] ${job?.name} #${job?.id} failed:`, err.message))
      .on('error', (err) => console.error(`[${name}]`, err.message)),
);

// Holds also stop counting the moment their deadline passes (every query checks
// holdUntil); the sweep just tidies their status and frees the RoomDay rows.
await queue(QUEUE.ops).upsertJobScheduler(
  JOB.expireHolds,
  { every: 60_000 },
  { name: JOB.expireHolds, opts: { removeOnComplete: true, removeOnFail: 100 } },
);

await prisma.$queryRaw`SELECT 1`;
console.log(`✓ worker up: queues ${Object.values(QUEUE).join(', ')}`);

async function shutdown(signal: string) {
  console.log(`${signal}: closing workers`);
  await Promise.all(workers.map((w) => w.close()));
  await queue(QUEUE.ops).close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
