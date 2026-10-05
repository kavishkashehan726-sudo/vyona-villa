import { prisma } from '@vyona/db';
import { Mark } from '@vyona/ui';

export const dynamic = 'force-dynamic';

// Placeholder until the dashboard lands in build step 5.
export default async function Dashboard() {
  const [rooms, reservations] = await Promise.all([prisma.room.count({ where: { active: true } }), prisma.reservation.count()]);
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <Mark className="h-10 text-bronze" />
      <h1 className="mt-6 text-2xl font-light">VYONA admin</h1>
      <p className="mt-2 text-taupe">
        {rooms} rooms · {reservations} reservations
      </p>
    </main>
  );
}
