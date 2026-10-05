// Idempotent seed: safe to run on every container start. Rooms are matched by
// slug and updated in place, so edits made later in the admin are overwritten
// only for the fields listed here (the brief's content), never prices that the
// owner changed: baseRate is set on create only.

import { prisma } from './index';
import { RATE_RULES, ROOMS, SETTINGS } from './seed-data';

async function main() {
  for (const { baseRate, ...room } of ROOMS) {
    await prisma.room.upsert({
      where: { slug: room.slug },
      create: { ...room, baseRate },
      update: room,
    });
  }
  // Rooms dropped from the brief stay in the database (reservations may point
  // at them) but disappear from the site.
  await prisma.room.updateMany({
    where: { slug: { notIn: ROOMS.map((r) => r.slug) } },
    data: { active: false },
  });

  if ((await prisma.rateRule.count()) === 0) {
    await prisma.rateRule.createMany({ data: RATE_RULES });
  }

  for (const [key, value] of Object.entries(SETTINGS)) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: value as never },
      update: {},
    });
  }

  const rooms = await prisma.room.count({ where: { active: true } });
  console.log(`✓ seed: ${rooms} rooms, ${await prisma.rateRule.count()} rate rules`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
