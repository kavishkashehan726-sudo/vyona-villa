import type { Metadata } from 'next';
import Link from 'next/link';
import { parseDay, toIso, today } from '@vyona/core/dates';
import { prisma } from '@vyona/db';
import { requireAdmin } from '@/lib/session';
import { NewBookingForm } from './NewBookingForm';

export const metadata: Metadata = { title: 'New booking' };

const iso = (v: string | string[] | undefined) => (typeof v === 'string' && parseDay(v) !== null ? v : '');

export default async function NewBookingPage({ searchParams }: PageProps<'/reservations/new'>) {
  await requireAdmin();
  const sp = await searchParams;
  const rooms = await prisma.room.findMany({
    where: { active: true },
    orderBy: { number: 'asc' },
    select: { id: true, number: true, name: true, maxGuests: true },
  });
  const t = today();
  const checkIn = iso(sp.from) || toIso(t);
  const checkOut = iso(sp.to) || toIso((parseDay(checkIn) ?? t) + 1);
  const roomId = typeof sp.room === 'string' && rooms.some((r) => r.id === sp.room) ? sp.room : '';

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">
            <Link href="/reservations">Bookings</Link> / New
          </p>
          <h1 className="h1">
            A booking <em>you took</em>
          </h1>
          <p className="lede">
            For a stay arranged by phone, WhatsApp or at the door. It’s confirmed straight away, closes the nights on the website and
            Booking.com, and ignores minimum stays.
          </p>
        </div>
      </div>
      <NewBookingForm rooms={rooms} initial={{ roomId, checkIn, checkOut, guests: 2 }} />
    </>
  );
}
