'use server';

import { revalidatePath } from 'next/cache';
import { beds24Mock, beds24Mode, Beds24Error, parseDay } from '@vyona/core';
import { prisma } from '@vyona/db';
import { attempt, fail, int, ok, text, type Result } from '@/lib/actions';
import { requireAdmin } from '@/lib/session';
import { syncPoll, syncPull, syncRates } from '@/lib/sync';

/** Links each room to its Beds24 room id (blank unlinks it), then sends the year's prices and any bookings Beds24 lacks. */
export async function linkRooms(_prev: Result, fd: FormData): Promise<Result> {
  await requireAdmin();
  const rooms = await prisma.room.findMany({ orderBy: { number: 'asc' }, select: { id: true, name: true, beds24RoomId: true } });
  const next = new Map<string, number | null>();
  for (const room of rooms) {
    const raw = text(fd, `b24:${room.id}`, 12);
    const id = raw ? int(raw) : null;
    if (raw && (id === null || id < 1)) return fail(`${room.name}: a Beds24 room id is a whole number, like 123456.`);
    next.set(room.id, id);
  }
  const ids = [...next.values()].filter((v) => v !== null);
  if (new Set(ids).size !== ids.length) return fail('Each Beds24 room id can belong to one room only.');

  const changed = rooms.filter((r) => r.beds24RoomId !== next.get(r.id));
  if (!changed.length) return ok('Nothing changed.');
  return attempt(async () => {
    // Clear first, so two rooms can swap ids without tripping the unique index.
    await prisma.$transaction([
      prisma.room.updateMany({ where: { id: { in: changed.map((r) => r.id) } }, data: { beds24RoomId: null } }),
      ...changed.map((r) => prisma.room.update({ where: { id: r.id }, data: { beds24RoomId: next.get(r.id) ?? null } })),
    ]);
    const queued = (await syncRates()) && (await syncPoll());
    revalidatePath('/channel');
    return ok(
      queued
        ? 'Saved. Prices, closed nights and bookings for the linked rooms are on their way to Beds24.'
        : 'Saved, but the update couldn’t be queued. The nightly sync will send it.',
    );
  });
}

/** Sends the year's prices and closures and checks for bookings, without waiting for the timers. */
export async function syncNow(_prev: Result, fd: FormData): Promise<Result> {
  await requireAdmin();
  const what = fd.get('what');
  const done = what === 'prices' ? await syncRates() : await syncPoll();
  revalidatePath('/channel');
  if (!done) return fail('Couldn’t start it: the job queue isn’t answering. Try again in a minute.');
  return ok(what === 'prices' ? 'Sending prices and closed nights now.' : 'Checking Beds24 for new and changed bookings now.');
}

/* ------------------------------------------ test mode: play Booking.com */

function testMode() {
  if (beds24Mode() !== 'mock') throw new Beds24Error('Only in test mode.');
  return beds24Mock();
}

/** Books a room "on Booking.com" in the mock, then lets the worker import it as a webhook would. */
export async function sellOnBookingCom(_prev: Result, fd: FormData): Promise<Result> {
  await requireAdmin();
  const roomId = int(text(fd, 'roomId', 12));
  const arrival = text(fd, 'arrival', 10);
  const departure = text(fd, 'departure', 10);
  const name = text(fd, 'name', 80) || 'Test Guest';
  if (!roomId) return fail('Choose a room that is linked to Beds24.');
  if (parseDay(arrival) === null || parseDay(departure) === null || departure <= arrival) return fail('Enter an arrival and a later departure.');
  try {
    const [first, ...rest] = name.split(/\s+/).reverse();
    const booking = await testMode().sell({
      roomId,
      arrival,
      departure,
      firstName: rest.reverse().join(' '),
      lastName: first!,
      numAdult: 2,
      force: fd.get('force') === 'on',
    });
    await syncPull(booking.id);
    revalidatePath('/channel');
    return ok(`Sold on “Booking.com” as ${booking.id}. It reaches the calendar in a few seconds.`);
  } catch (err) {
    if (err instanceof Beds24Error) return fail(err.message);
    throw err;
  }
}

/** The "Booking.com guest" cancels: the mock marks it cancelled and the worker imports that. */
export async function cancelOnBookingCom(id: number): Promise<void> {
  await requireAdmin();
  await testMode().cancelSale(id);
  await syncPull(id);
  revalidatePath('/channel');
}
