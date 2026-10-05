import { prisma } from '@vyona/db';
import { Icon, Logo, type IconName } from '@vyona/ui';

export const dynamic = 'force-dynamic';

// Scaffold check: tokens, fonts, icons and the database. The real home page
// (the prototype ported to React) replaces this in build step 3.
export default async function Home() {
  const rooms = await prisma.room.findMany({ where: { active: true }, orderBy: { number: 'asc' } });
  return (
    <main className="mx-auto max-w-3xl px-6 py-24 text-center">
      <Logo className="mx-auto block w-fit text-5xl text-ink" />
      <h1 className="mt-16 font-serif text-hero leading-tight">
        Your home on the South Coast. <em className="text-bronze">Naturally.</em>
      </h1>
      <ul className="mt-16 grid gap-4 text-left sm:grid-cols-2">
        {rooms.map((r) => (
          <li key={r.id} className="flex items-center gap-4 border-t border-stone pt-4">
            <Icon name={r.icon as IconName} className="size-8 text-bronze" />
            <span className="font-sans text-caps tracking-caps uppercase">
              {r.number} - {r.name}
            </span>
            <span className="ml-auto text-taupe">from ${r.baseRate / 100}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
