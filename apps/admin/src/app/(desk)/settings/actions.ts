'use server';

import { revalidatePath } from 'next/cache';
import {
  changePassword,
  CONTACT_KEY,
  DEFAULT_SETTINGS,
  MIN_PASSWORD,
  SOCIAL_LABELS,
  SOCIALS,
  type BookingSettings,
  type ContactDetails,
} from '@vyona/core';
import { prisma } from '@vyona/db';
import { attempt, fail, ok, text, type Result } from '@/lib/actions';
import { getToken, requireAdmin } from '@/lib/session';
import { syncRates } from '@/lib/sync';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function whole(fd: FormData, name: string, min: number, max: number, label: string) {
  const v = Number(text(fd, name, 10));
  if (!Number.isInteger(v) || v < min || v > max) throw new Error(`${label} must be a whole number from ${min} to ${max}.`);
  return v;
}

export async function saveSettings(_prev: Result, fd: FormData): Promise<Result> {
  await requireAdmin();
  let next: BookingSettings;
  try {
    const checkInTime = text(fd, 'checkInTime', 5);
    const checkOutTime = text(fd, 'checkOutTime', 5);
    if (!TIME.test(checkInTime) || !TIME.test(checkOutTime)) return fail('Enter check-in and check-out as times, like 14:00.');
    const currency = text(fd, 'chargeCurrency', 3);
    next = {
      serviceChargePercent: whole(fd, 'serviceChargePercent', 0, 30, 'Service charge'),
      longStayNights: whole(fd, 'longStayNights', 2, 60, 'Long stay'),
      longStayPercent: whole(fd, 'longStayPercent', 0, 50, 'Long-stay discount'),
      holdMinutes: whole(fd, 'holdMinutes', 5, 60, 'Payment time'),
      lkrPerUsd: whole(fd, 'lkrPerUsd', 100, 1000, 'Rupees to the dollar'),
      chargeCurrency: currency === 'LKR' ? 'LKR' : 'USD',
      checkInTime,
      checkOutTime,
      payAtVilla: fd.get('payAtVilla') === 'on',
    };
  } catch (err) {
    return fail((err as Error).message);
  }
  return attempt(async () => {
    const keys = Object.keys(DEFAULT_SETTINGS) as (keyof BookingSettings)[];
    await prisma.$transaction(
      keys.map((key) => prisma.setting.upsert({ where: { key }, create: { key, value: next[key] }, update: { value: next[key] } })),
    );
    await syncRates();
    revalidatePath('/', 'layout');
    return ok('Saved. The website uses the new settings straight away.');
  });
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s()-]{7,20}$/;

export async function saveContact(_prev: Result, fd: FormData): Promise<Result> {
  await requireAdmin();
  const address = text(fd, 'address', 200);
  const phone = text(fd, 'phone', 20);
  const whatsapp = text(fd, 'whatsapp', 25).replace(/\D/g, '');
  const email = text(fd, 'email', 120);
  const mapQuery = text(fd, 'mapQuery', 200);
  if (!address) return fail('Enter the address.');
  if (!PHONE.test(phone)) return fail('Enter the phone number with digits only, like +94 77 123 4567.');
  if (whatsapp && (whatsapp.length < 8 || whatsapp.length > 15)) return fail('Enter the WhatsApp number with its country code, like +94 77 123 4567.');
  if (!EMAIL.test(email)) return fail('Enter an email address, like stay@example.com.');
  if (!mapQuery) return fail('Enter what the map should show: the address, a place name or coordinates.');
  const social = {} as ContactDetails['social'];
  for (const key of SOCIALS) {
    const url = text(fd, key, 300);
    if (url && !/^https:\/\/[^\s]+\.[^\s]+$/.test(url)) return fail(`Paste the full ${SOCIAL_LABELS[key]} link, starting with https://.`);
    social[key] = url;
  }
  const value: ContactDetails = { address, phone, whatsapp, email, mapQuery, social };
  return attempt(async () => {
    await prisma.setting.upsert({ where: { key: CONTACT_KEY }, create: { key: CONTACT_KEY, value }, update: { value } });
    return ok('Saved. The website shows the new details straight away.');
  });
}

export async function savePassword(_prev: Result, fd: FormData): Promise<Result> {
  const admin = await requireAdmin();
  return attempt(async () => {
    const current = String(fd.get('current') ?? '');
    const next = String(fd.get('next') ?? '');
    if (next !== String(fd.get('confirm') ?? '')) return fail('The new passwords don’t match.');
    const res = await changePassword(admin.id, current, next, await getToken());
    if (res === 'WRONG_PASSWORD') return fail('Your current password isn’t right.');
    if (res === 'TOO_SHORT') return fail(`Use at least ${MIN_PASSWORD} characters.`);
    return ok('Password changed. Other browsers have been signed out.');
  });
}
