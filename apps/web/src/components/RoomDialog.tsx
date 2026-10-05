'use client';

// Room details in a modal, opened by any [data-room-open="slug"] button on the
// page (the room cards). "Check dates" hands over to the booking drawer.

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from '@vyona/ui';
import { setPhoto } from '@/client/images';
import { lockScroll } from '@/client/ui';
import { roomTitle, type RoomData } from '@/lib/rooms';
import { Price } from './Price';

export function RoomDialog({ rooms }: { rooms: RoomData[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const media = useRef<HTMLDivElement>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const room = rooms.find((r) => r.slug === slug);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const b = (e.target as Element).closest<HTMLElement>('[data-room-open]');
      const dlg = ref.current;
      if (!b || !dlg?.showModal) return;
      e.preventDefault();
      setSlug(b.dataset.roomOpen ?? null);
      if (!dlg.open) {
        dlg.showModal();
        lockScroll(true);
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    media.current?.querySelectorAll<HTMLImageElement>('img[data-key]').forEach((img) => {
      setPhoto(img, img.dataset.key!, { eager: true });
    });
  }, [slug]);

  const close = () => ref.current?.close();

  return (
    <dialog
      ref={ref}
      className="room-dialog"
      aria-labelledby="room-dialog-title"
      onClose={() => lockScroll(false)}
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <button type="button" className="icon-btn room-dialog__close" aria-label="Close room details" onClick={close}>
        <Icon name="close" className="i" />
      </button>
      {room && (
        <>
          <div className="room-dialog__media" ref={media} key={room.slug}>
            {room.photos.map((k, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- loaded by client/images.ts
              <img key={k} data-key={k} alt={`${room.name} room, photo ${i + 1}`} />
            ))}
          </div>
          <div className="room-dialog__body">
            <Icon name={room.icon as IconName} className="room-card__icon" />
            <p className="eyebrow">The {room.element} room</p>
            <h2 className="h2" id="room-dialog-title">
              {roomTitle(room)}
            </h2>
            <hr className="rule" />
            {room.keywords.length > 0 && <p>{room.keywords.join(' · ')}</p>}
            <dl className="room-dialog__facts">
              <div>
                <dt>Room</dt>
                <dd>{room.category}</dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>{room.sizeSqm} m²</dd>
              </div>
              <div>
                <dt>Sleeps</dt>
                <dd>Up to {room.maxGuests}</dd>
              </div>
              <div>
                <dt>From</dt>
                <dd>
                  <Price cents={room.baseRate} /> / night
                </dd>
              </div>
            </dl>
            <ul className="room-dialog__amen">
              {room.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <div className="stay-room__actions">
              <Link
                className="btn btn--olive magnetic"
                href={`/book?room=${room.slug}`}
                data-open-booking
                data-room={room.slug}
                data-cursor="Book"
              >
                Check dates for {room.name}
              </Link>
              <Link className="link-caps" href={`/stay/${room.slug}`} onClick={close}>
                Room details <Icon name="arrow" className="i" />
              </Link>
            </div>
            <p className="proto-note">Room photos are placeholders until the client confirms them.</p>
          </div>
        </>
      )}
    </dialog>
  );
}
