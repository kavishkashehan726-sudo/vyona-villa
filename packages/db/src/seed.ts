// Idempotent seed: safe to run on every container start. Rooms are matched by
// slug and updated in place, so edits made later in the admin are overwritten
// only for the fields listed here (the brief's content), never what the owner
// manages in the admin: baseRate and photos are set on create only.

import { prisma } from './index';
import { hashPassword, MIN_PASSWORD } from './password';
import { RATE_RULES, ROOMS, SETTINGS } from './seed-data';

async function main() {
  for (const { baseRate, photos, ...room } of ROOMS) {
    await prisma.room.upsert({
      where: { slug: room.slug },
      create: { ...room, baseRate, photos },
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

  await seedAdmin();

  const rooms = await prisma.room.count({ where: { active: true } });
  console.log(`✓ seed: ${rooms} rooms, ${await prisma.rateRule.count()} rate rules`);
}

// The first login comes from ADMIN_EMAIL / ADMIN_PASSWORD. Created once and
// never overwritten, so a password changed in the admin survives restarts.
async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? '';
  if (!email || !password) {
    if ((await prisma.adminUser.count()) === 0) console.warn('seed: no admin user; set ADMIN_EMAIL and ADMIN_PASSWORD');
    return;
  }
  if (await prisma.adminUser.findUnique({ where: { email } })) return;
  if (password.length < MIN_PASSWORD) {
    console.warn(`seed: ADMIN_PASSWORD needs at least ${MIN_PASSWORD} characters; admin user not created`);
    return;
  }
  await prisma.adminUser.create({ data: { email, name: 'Owner', passwordHash: await hashPassword(password) } });
  console.log(`✓ seed: admin user ${email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
