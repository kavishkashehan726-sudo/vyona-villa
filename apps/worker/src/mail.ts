// Booking emails. Plain HTML with inline styles (mail clients ignore <style>),
// plus a text part. Everything the guest typed is escaped.

import { loadSettings } from '@vyona/core';
import { prisma } from '@vyona/db';
import nodemailer from 'nodemailer';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const FROM = process.env.MAIL_FROM || 'VYONA Weligama <stay@vyonaweligama.com>';
const ADMIN_URL = process.env.ADMIN_URL ?? 'http://localhost:3001';
const OWNER = process.env.ADMIN_EMAIL?.trim();

const transport = nodemailer.createTransport(process.env.SMTP_URL ?? 'smtp://localhost:1025');

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const dateFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export function money(cents: number, currency: string) {
  if (currency === 'USD') {
    return `US$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${currency} ${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

async function booking(reservationId: string) {
  const r = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { room: true, payments: { orderBy: { createdAt: 'desc' } } },
  });
  if (!r) throw new Error(`No reservation ${reservationId}`);
  const nights = Math.round((r.checkOut.getTime() - r.checkIn.getTime()) / 86_400_000);
  const paid = r.payments.find((p) => p.status === 'PAID');
  const villa = r.payments.find((p) => p.provider === 'VILLA');
  const payment = paid
    ? `Paid by card: ${money(paid.amount, paid.currency)}`
    : villa
      ? `To pay at the villa on arrival: ${money(villa.amount, villa.currency)}`
      : 'Not paid yet';
  return { r, nights, payment, link: `${SITE_URL}/book/${r.ref}`, desk: `${ADMIN_URL}/reservations/${r.id}` };
}

type Row = [label: string, value: string];

/** One email in the site's colours: linen page, olive heading, bronze rules. */
function layout(title: string, intro: string, rows: Row[], outro = '') {
  const table = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;color:#6B6457;font:12px/1.4 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;vertical-align:top;width:38%">${esc(k)}</td>` +
        `<td style="padding:8px 0;color:#2B2A26;font:15px/1.5 Georgia,serif">${esc(v)}</td></tr>`,
    )
    .join('');
  const html = `<!doctype html><html><body style="margin:0;background:#F1ECE3">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;color:#2B2A26">
  <p style="margin:0 0 28px;font:13px Arial,sans-serif;letter-spacing:.42em;color:#4A4F3A;text-align:center">VYONA</p>
  <h1 style="margin:0 0 16px;font:400 28px/1.25 Georgia,serif;color:#4A4F3A;text-align:center">${esc(title)}</h1>
  <p style="margin:0 0 24px;font:15px/1.7 Georgia,serif;color:#6B6457;text-align:center">${intro}</p>
  <table role="presentation" style="width:100%;border-collapse:collapse;border-top:1px solid #A88B5E;border-bottom:1px solid #A88B5E">${table}</table>
  ${outro ? `<p style="margin:24px 0 0;font:15px/1.7 Georgia,serif;color:#6B6457;text-align:center">${outro}</p>` : ''}
  <p style="margin:36px 0 0;font:11px/1.6 Arial,sans-serif;letter-spacing:.2em;color:#A88B5E;text-align:center;text-transform:uppercase">Weligama · Sri Lanka</p>
</div></body></html>`;
  const text = [title, '', intro.replace(/<[^>]+>/g, ''), '', ...rows.map(([k, v]) => `${k}: ${v}`), '', outro.replace(/<[^>]+>/g, '')]
    .join('\n')
    .replace(/&rsquo;/g, '’')
    .replace(/&amp;/g, '&')
    .trim();
  return { html, text };
}

const button = (href: string, label: string) =>
  `<a href="${esc(href)}" style="display:inline-block;padding:14px 28px;background:#4A4F3A;color:#F1ECE3;font:12px Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase;text-decoration:none">${esc(label)}</a>`;

export async function sendGuestConfirmation(reservationId: string) {
  const [{ r, nights, payment, link }, settings] = await Promise.all([booking(reservationId), loadSettings()]);
  if (r.status !== 'CONFIRMED') return `skipped: ${r.ref} is ${r.status}`;
  if (!r.email) return `skipped: ${r.ref} has no email address`;
  const first = r.guestName.trim().split(/\s+/)[0];
  const { html, text } = layout(
    'See you in Weligama.',
    `Thank you, ${esc(first)}. Your stay at VYONA is confirmed.`,
    [
      ['Reference', r.ref],
      ['Room', `${r.room.name}, the ${r.room.element} room`],
      ['Check-in', `${dateFmt.format(r.checkIn)}, from ${settings.checkInTime}`],
      ['Check-out', `${dateFmt.format(r.checkOut)}, by ${settings.checkOutTime}`],
      ['Nights', String(nights)],
      ['Guests', String(r.guests)],
      ['Total', money(r.total, r.currency)],
      ['Payment', payment],
    ],
    `${button(link, 'View your booking')}<br><br>Questions before you arrive? Just reply to this email.`,
  );
  await transport.sendMail({
    from: FROM,
    to: { name: r.guestName, address: r.email },
    replyTo: OWNER || undefined,
    subject: `Your stay at VYONA is confirmed · ${r.ref}`,
    html,
    text: `${text}\n\nView your booking: ${link}`,
  });
  return `sent to guest for ${r.ref}`;
}

export async function sendGuestCancellation(reservationId: string) {
  const { r, nights } = await booking(reservationId);
  if (r.status !== 'CANCELLED') return `skipped: ${r.ref} is ${r.status}`;
  if (!r.email) return `skipped: ${r.ref} has no email address`;
  const first = r.guestName.trim().split(/\s+/)[0];
  const paid = r.payments.find((p) => p.status === 'PAID');
  const { html, text } = layout(
    'Your booking is cancelled.',
    `${esc(first)}, your stay at VYONA has been cancelled.`,
    [
      ['Reference', r.ref],
      ['Room', r.room.name],
      ['Dates', `${dateFmt.format(r.checkIn)} → ${dateFmt.format(r.checkOut)}`],
      ['Nights', String(nights)],
      ...(paid ? ([['Refund', `${money(paid.amount, paid.currency)} to the card you paid with`]] as Row[]) : []),
    ],
    `${paid ? 'Refunds usually reach your card within 5 to 10 working days. ' : ''}If this is a surprise, or you’d like new dates, just reply to this email.`,
  );
  await transport.sendMail({
    from: FROM,
    to: { name: r.guestName, address: r.email },
    replyTo: OWNER || undefined,
    subject: `Your VYONA booking is cancelled · ${r.ref}`,
    html,
    text,
  });
  return `cancellation sent to guest for ${r.ref}`;
}

export async function sendOwnerBooking(reservationId: string) {
  if (!OWNER) return 'skipped: ADMIN_EMAIL is not set';
  const { r, nights, payment, desk } = await booking(reservationId);
  const { html, text } = layout(
    `New booking ${r.ref}`,
    `${esc(r.guestName)} booked ${esc(r.room.name)} for ${nights} night${nights === 1 ? '' : 's'}.`,
    [
      ['Room', `${r.room.number} - ${r.room.name}`],
      ['Dates', `${dateFmt.format(r.checkIn)} → ${dateFmt.format(r.checkOut)}`],
      ['Guests', String(r.guests)],
      ['Guest', r.guestName],
      ['Email', r.email],
      ['Phone', r.phone ?? '—'],
      ['Country', r.country ?? '—'],
      ['Arrival time', r.arrivalTime ?? '—'],
      ['Notes', r.notes ?? '—'],
      ['Total', money(r.total, r.currency)],
      ['Payment', payment],
    ],
    button(desk, 'Open booking'),
  );
  await transport.sendMail({
    from: FROM,
    to: OWNER,
    replyTo: { name: r.guestName, address: r.email },
    subject: `New booking ${r.ref} · ${r.room.name} · ${dateFmt.format(r.checkIn)}`,
    html,
    text,
  });
  return `sent to owner for ${r.ref}`;
}

export async function sendOwnerRefund(reservationId: string, orderId: string) {
  const { r, desk } = await booking(reservationId);
  const p = await prisma.payment.findUnique({ where: { orderId } });
  const rows: Row[] = [
    ['Reference', r.ref],
    ['PayHere order', orderId],
    ['PayHere payment', p?.paymentId ?? '—'],
    ['Amount paid', p ? money(p.amount, p.currency) : '—'],
    ['Room', `${r.room.number} - ${r.room.name}`],
    ['Dates', `${dateFmt.format(r.checkIn)} → ${dateFmt.format(r.checkOut)}`],
    ['Guest', `${r.guestName} <${r.email}>`],
    ['Phone', r.phone ?? '—'],
  ];
  const intro = 'A guest paid after their hold ran out, and the nights were no longer free. Refund the payment in PayHere and let the guest know.';
  if (!OWNER) {
    // Nobody to tell: make it loud in the logs so it can't go unnoticed.
    console.error(`REFUND NEEDED ${r.ref} (order ${orderId}); ADMIN_EMAIL is not set`);
    return 'skipped: ADMIN_EMAIL is not set';
  }
  const { html, text } = layout(`Refund needed: ${r.ref}`, intro, rows, button(desk, 'Open booking'));
  await transport.sendMail({ from: FROM, to: OWNER, subject: `Refund needed: ${r.ref} (${orderId})`, html, text });
  return `refund alert sent for ${r.ref}`;
}
