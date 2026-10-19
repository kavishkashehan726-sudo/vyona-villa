import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { externalBookingUrl } from '@vyona/core';
import { PageEffects } from '@/components/PageEffects';
import { Booking } from '@/components/sections/Booking';
import { getRooms, getSettings } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Book',
  description: 'Check availability and book VYONA direct for the best rate.',
  alternates: { canonical: '/book' },
};

export default async function BookPage({ searchParams }: PageProps<'/book'>) {
  // Online booking is off in the admin: guests book on Booking.com (Book buttons already go there with JS).
  const out = externalBookingUrl(await getSettings());
  if (out) redirect(out);
  const { room } = await searchParams;
  const rooms = await getRooms();
  const slug = typeof room === 'string' && rooms.some((r) => r.slug === room) ? room : undefined;
  return (
    <>
      <div className="page-top" />
      <Booking room={slug} title="Choose your dates." />
      <PageEffects />
    </>
  );
}
