'use server';

import { revalidatePath } from 'next/cache';
import { MAX_PRICE } from '@vyona/core';
import { prisma } from '@vyona/db';
import { attempt, cents, fail, int, ok, text, type Result } from '@/lib/actions';
import { requireAdmin } from '@/lib/session';
import { syncRates } from '@/lib/sync';

async function changed(message: string) {
  await syncRates();
  revalidatePath('/', 'layout');
  return ok(message);
}

export async function saveBaseRates(_prev: Result, fd: FormData): Promise<Result> {
  await requireAdmin();
  return attempt(async () => {
    const rooms = await prisma.room.findMany({ select: { id: true, name: true, baseRate: true } });
    const updates: { id: string; baseRate: number }[] = [];
    for (const room of rooms) {
      const raw = text(fd, `rate:${room.id}`, 20);
      if (!raw) continue;
      const rate = cents(raw);
      if (rate === null || rate < 100 || rate > MAX_PRICE) return fail(`Enter ${room.name}’s rate in dollars, between 1 and 10,000.`);
      if (rate !== room.baseRate) updates.push({ id: room.id, baseRate: rate });
    }
    if (!updates.length) return ok('No rates changed.');
    await prisma.$transaction(updates.map((u) => prisma.room.update({ where: { id: u.id }, data: { baseRate: u.baseRate } })));
    return changed(`Saved ${updates.length === 1 ? 'the new rate' : `${updates.length} new rates`}.`);
  });
}

type RuleData = { name: string; percent: number; months: number[]; weekdays: number[]; active: boolean };

function ruleFields(fd: FormData): { error: string } | { data: RuleData } {
  const name = text(fd, 'name', 80);
  const percent = int(text(fd, 'percent', 5));
  const months = [...new Set(fd.getAll('months').map(Number))].filter((m) => Number.isInteger(m) && m >= 1 && m <= 12).sort((a, b) => a - b);
  const weekdays = [...new Set(fd.getAll('weekdays').map(Number))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort((a, b) => a - b);
  if (!name) return { error: 'Give the rule a name, like “Peak season”.' };
  if (percent === null || percent === 0 || percent < -90 || percent > 300) return { error: 'Enter a change between −90% and +300%, not 0.' };
  return { data: { name, percent, months, weekdays, active: fd.get('active') === 'on' } };
}

export async function saveRule(id: string | null, _prev: Result, fd: FormData): Promise<Result> {
  await requireAdmin();
  return attempt(async () => {
    const r = ruleFields(fd);
    if ('error' in r) return fail(r.error);
    if (id) {
      await prisma.rateRule.update({ where: { id }, data: r.data });
      return changed('Saved the rule.');
    }
    const last = await prisma.rateRule.aggregate({ _max: { sort: true } });
    await prisma.rateRule.create({ data: { ...r.data, sort: (last._max.sort ?? 0) + 1 } });
    return changed('Added the rule.');
  });
}

export async function deleteRule(id: string, _prev: Result, _fd: FormData): Promise<Result> {
  await requireAdmin();
  return attempt(async () => {
    await prisma.rateRule.deleteMany({ where: { id } });
    return changed('Deleted the rule.');
  });
}
