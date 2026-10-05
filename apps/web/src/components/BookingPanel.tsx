'use client';

// The booking widget's home inside a page. client/booking.ts owns the DOM;
// the same widget moves into the drawer when a "Book" button is pressed.

import { useEffect, useRef } from 'react';
import { mountBooking } from '@/client/booking';

export function BookingPanel({ room }: { room?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => (ref.current ? mountBooking(ref.current, room) : undefined), [room]);
  return <div className="booking__panel" data-booking-panel ref={ref} />;
}
