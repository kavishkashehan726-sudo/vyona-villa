// Line icons from the prototype (thin bronze strokes), plus the star for Tara.
// Element icons use a 32-unit grid, UI icons a 24-unit grid.

import type { ReactNode, SVGProps } from 'react';

type Def = { box: 24 | 32; width?: number; body: ReactNode };

const round = { strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const ICONS = {
  // Elements
  earth: { box: 32, body: <g {...round}><path d="M16 29V13" /><path d="M16 20c-5-1-8-5-8-10 5 0 8 3 8 8" /><path d="M16 17c4-1 7-4 7-9-4 0-7 3-7 7" /><path d="M16 29c-3-3-6-4-10-4M16 29c3-3 6-4 10-4" /></g> },
  water: { box: 32, body: <g strokeLinecap="round"><path d="M3 11c3-3 5-3 7 0s4 3 6 0 4-3 6 0 4 3 7 0" /><path d="M3 17c3-3 5-3 7 0s4 3 6 0 4-3 6 0 4 3 7 0" /><path d="M3 23c3-3 5-3 7 0s4 3 6 0 4-3 6 0 4 3 7 0" /></g> },
  fire: { box: 32, body: <g {...round}><path d="M16 29c-5 0-8-3.5-8-8 0-5 4-8 5-13 3 2 4 5 4 8 1-1 2-3 2-5 3 3 5 6 5 10 0 4.5-3 8-8 8Z" /><path d="M16 29c-2 0-3.5-1.6-3.5-3.6 0-2.4 2-3.6 3.5-6 1.5 2.4 3.5 3.6 3.5 6 0 2-1.5 3.6-3.5 3.6Z" /></g> },
  air: { box: 32, body: <path strokeLinecap="round" d="M16 16a2 2 0 1 1 2-2c0 3-3 5-6 5a6 6 0 0 1-6-6c0-5 4-9 9-9 6 0 11 5 11 11 0 7-6 12-13 12" /> },
  sun: { box: 32, body: <g strokeLinecap="round"><circle cx="16" cy="16" r="5.5" /><path d="M16 3v4M16 25v4M3 16h4M25 16h4M6.8 6.8l2.8 2.8M22.4 22.4l2.8 2.8M6.8 25.2l2.8-2.8M22.4 9.6l2.8-2.8" /></g> },
  moon: { box: 32, body: <path strokeLinejoin="round" d="M20 4a12 12 0 1 0 8 19A11 11 0 0 1 20 4Z" /> },
  star: { box: 32, body: <g {...round}><path d="m16 4 3 8.2 8.7.4-6.8 5.4 2.4 8.4L16 21.6l-7.3 4.8 2.4-8.4-6.8-5.4 8.7-.4Z" /><path d="M26 3.5v3M24.5 5h3" /></g> },
  // Amenities
  leaf: { box: 32, body: <g {...round}><path d="M6 26C6 13 13 6 26 6c0 13-7 20-20 20Z" /><path d="M6 26 19 13M12 20h6M15 17v-5" /></g> },
  pool: { box: 32, body: <g strokeLinecap="round"><path d="M10 20V7a3 3 0 0 1 6 0M20 20V7a3 3 0 0 1 6 0M10 12h10M10 16h10" /><path d="M3 24c3-2.5 5-2.5 7 0s4 2.5 6 0 4-2.5 6 0 4 2.5 7 0" /><path d="M3 28c3-2.5 5-2.5 7 0s4 2.5 6 0 4-2.5 6 0 4 2.5 7 0" /></g> },
  pin: { box: 32, body: <g strokeLinejoin="round"><path d="M16 29s-9-8.5-9-15a9 9 0 0 1 18 0c0 6.5-9 15-9 15Z" /><circle cx="16" cy="14" r="3.2" /></g> },
  heart: { box: 32, body: <path strokeLinejoin="round" d="M16 27S4 19.5 4 11.5A6 6 0 0 1 16 9a6 6 0 0 1 12 2.5C28 19.5 16 27 16 27Z" /> },
  // UI
  arrow: { box: 24, width: 1.3, body: <path {...round} d="M4 12h15M14 7l5 5-5 5" /> },
  close: { box: 24, width: 1.3, body: <path strokeLinecap="round" d="M5 5l14 14M19 5 5 19" /> },
  chev: { box: 24, width: 1.3, body: <path {...round} d="m9 5 7 7-7 7" /> },
  insta: { box: 24, width: 1.3, body: <g><rect x="3.5" y="3.5" width="17" height="17" rx="4.5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r=".6" fill="currentColor" /></g> },
  facebook: { box: 24, width: 1.3, body: <g strokeLinejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5" /><path strokeLinecap="round" d="M15 7.5h-1.5A2.5 2.5 0 0 0 11 10v10.5M9 12.5h5" /></g> },
  tiktok: { box: 24, width: 1.3, body: <path {...round} d="M13.5 3.5v11.2a3.3 3.3 0 1 1-3.3-3.3M13.5 3.5c.3 2.6 2.2 4.5 4.8 4.8" /> },
  youtube: { box: 24, width: 1.3, body: <g strokeLinejoin="round"><rect x="2.5" y="5.5" width="19" height="13" rx="4" /><path d="m10 9.2 5 2.8-5 2.8Z" /></g> },
  tripadvisor: { box: 24, width: 1.3, body: <g><circle cx="7.5" cy="13" r="3.8" /><circle cx="16.5" cy="13" r="3.8" /><circle cx="7.5" cy="13" r=".9" fill="currentColor" /><circle cx="16.5" cy="13" r=".9" fill="currentColor" /><path {...round} d="M3.2 8.6h3.6a9 9 0 0 1 10.4 0h3.6M12 16.8l-.8 1.3h1.6Z" /></g> },
  whatsapp: { box: 24, width: 1.3, body: <g strokeLinejoin="round"><path d="M4 20l1.2-4.2A8.5 8.5 0 1 1 8.4 19Z" /><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 .8a4.5 4.5 0 0 1-2.2-2.2l.8-1-1-2Z" /></g> },
  mail: { box: 24, width: 1.3, body: <g strokeLinejoin="round"><rect x="3" y="5.5" width="18" height="13" rx="1.5" /><path d="m3.5 6.5 8.5 6.5 8.5-6.5" /></g> },
  phone: { box: 24, width: 1.3, body: <path strokeLinejoin="round" d="M6.5 3.5h3l1.5 4-2 1.5a10 10 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2-2Z" /> },
} satisfies Record<string, Def>;

export type IconName = keyof typeof ICONS;

type Props = Omit<SVGProps<SVGSVGElement>, 'name'> & { name: IconName; title?: string };

export function Icon({ name, title, className, ...rest }: Props) {
  const def: Def = ICONS[name];
  return (
    <svg
      viewBox={`0 0 ${def.box} ${def.box}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={def.width ?? 1.2}
      className={className ?? 'size-[1em]'}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
      {...rest}
    >
      {def.body}
    </svg>
  );
}
