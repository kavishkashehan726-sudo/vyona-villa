'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminQuote, AdminError, cancelReservation, createManualBooking, moveReservation, type Quote } from '@vyona/core';
import { prisma } from '@vyona/db';
import { attempt, cents, fail, int, ok, text, type Result } from '@/lib/actions';
import { money } from '@/lib/format';
import { requireAdmin } from '@/lib/session';
import { syncCancel, syncManual, syncMove } from '@/lib/sync';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type QuoteResult = { quote: Quote } | { error: string };

/** The usual price for a stay, for the booking forms. */
export async function quoteStay(roomId: string, checkIn: string, checkOut: string): Promise<QuoteResult> {
  await requireAdmin();
  try {
    return { quote: await adminQuote(roomId, checkIn, checkOut) };
  } catch (err) {
    if (err instanceof AdminError) return { error: err.message };
    console.error('[admin] quote', err);
    return { error: 'Couldn’t work out the price.' };
  }
}

function guestFields(fd: FormData) {
  const guest = {
    name: text(fd, 'name', 120),
    email: text(fd, 'email', 200).toLowerCase(),
    phone: text(fd, 'phone', 40),
    country: text(fd, 'country', 80),
    arrivalTime: text(fd, 'arrivalTime', 40),
    notes: text(fd, 'notes', 2000),
  };
  if (guest.name.length < 2) throw new AdminError('INVALID', 'Enter the name the booking is for.');
  if (guest.email && !EMAIL.test(guest.email)) throw new AdminError('INVALID', 'That email address doesn’t look right.');
  return guest;
}

/** Dollars from a "custom total" field: blank means the usual price. */
function customTotal(fd: FormData) {
  const raw = text(fd, 'total', 20);
  if (!raw) return null;
  const total = cents(raw);
  if (total === null) throw new AdminError('INVALID', 'Enter the total in dollars, like 240 or 240.50.');
  return total;
}

export async function createBooking(_prev: Result, fd: FormData): Promise<Result> {
  await requireAdmin();
  let id = '';
  const result = await attempt(async () => {
    const guest = guestFields(fd);
    const emailGuest = fd.get('emailGuest') === 'on';
    if (emailGuest && !guest.email) return fail('Add the guest’s email to send them a confirmation.');
    const booking = await createManualBooking({
      roomId: text(fd, 'roomId', 40),
      checkIn: text(fd, 'checkIn', 10),
      checkOut: text(fd, 'checkOut', 10),
      guests: int(text(fd, 'guests', 2)) ?? 0,
      guest,
      ownerNotes: text(fd, 'ownerNotes', 2000),
      total: customTotal(fd),
    });
    await syncManual(booking.id, emailGuest);
    revalidatePath('/', 'layout');
    id = booking.id;
    return null;
  });
  if (id) redirect(`/reservations/${id}?saved=created`);
  return result;
}

export async function updateGuest(id: string, _prev: Result, fd: FormData): Promise<Result> {
  await requireAdmin();
  return attempt(async () => {
    const g = guestFields(fd);
    await prisma.reservation.update({
      where: { id },
      data: {
        guestName: g.name,
        email: g.email,
        phone: g.phone || null,
        country: g.country || null,
        arrivalTime: g.arrivalTime || null,
        notes: g.notes || null,
      },
    });
    revalidatePath(`/reservations/${id}`);
    return ok('Saved the guest’s details.');
  });
}

export async function updateOwnerNotes(id: string, _prev: Result, fd: FormData): Promise<Result> {
  await requireAdmin();
  return attempt(async () => {
    await prisma.reservation.update({ where: { id }, data: { ownerNotes: text(fd, 'ownerNotes', 2000) || null } });
    revalidatePath(`/reservations/${id}`);
    return ok('Saved your notes.');
  });
}

export async function moveBooking(id: string, _prev: Result, fd: FormData): Promise<Result> {
  await requireAdmin();
  return attempt(async () => {
    const current = await prisma.reservation.findUnique({ where: { id }, select: { total: true } });
    if (!current) return fail('That booking no longer exists.');
    const mode = text(fd, 'pricing', 10);
    const total = mode === 'keep' ? current.total : mode === 'custom' ? customTotal(fd) : null;
    if (mode === 'custom' && total === null) return fail('Enter the new total, or choose another pricing option.');
    const moved = await moveReservation(id, {
      roomId: text(fd, 'roomId', 40),
      checkIn: text(fd, 'checkIn', 10),
      checkOut: text(fd, 'checkOut', 10),
      guests: int(text(fd, 'guests', 2)) ?? 0,
      total,
    });
    await syncMove(id);
    revalidatePath('/', 'layout');
    const change = moved.total === current.total ? '' : ` The total is now ${money(moved.total, moved.currency)}.`;
    return ok(`Moved the booking.${change}`);
  });
}

export async function cancelBooking(id: string, _prev: Result, fd: FormData): Promise<Result> {
  await requireAdmin();
  // The cancel card goes once the booking is cancelled, taking its message with
  // it, so the page says what happened instead (and the refund banner, if any).
  let saved = '';
  const result = await attempt(async () => {
    const { reservation } = await cancelReservation(id);
    const emailGuest = fd.get('emailGuest') === 'on' && !!reservation.email;
    await syncCancel(id, emailGuest);
    revalidatePath('/', 'layout');
    saved = emailGuest ? 'cancelled-emailed' : 'cancelled';
    return null;
  });
  if (saved) redirect(`/reservations/${id}?saved=${saved}`);
  return result;
}
