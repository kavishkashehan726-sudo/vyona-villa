import type { Metadata } from 'next';
import { prisma } from '@vyona/db';
import { PHOTOS } from '@vyona/db/media-data';
import { Icon, type IconName } from '@vyona/ui';
import { ActionForm, Submit } from '@/components/ActionForm';
import { requireAdmin } from '@/lib/session';
import { deletePhoto, editRoomPhotos, replacePhoto, saveAlt, uploadPhoto } from './actions';

export const metadata: Metadata = { title: 'Photos' };

const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/tiff';

type Media = { key: string; path: string; alt: string; width: number; height: number; lqip: string };

function Thumb({ m }: { m: Media }) {
  return (
    <img
      className="thumb"
      src={`/media/${m.path}`}
      alt={m.alt}
      width={m.width}
      height={m.height}
      loading="lazy"
      decoding="async"
      style={{ backgroundImage: `url(${m.lqip})` }}
    />
  );
}

export default async function PhotosPage() {
  await requireAdmin();
  const [rooms, media] = await Promise.all([
    prisma.room.findMany({ where: { active: true }, orderBy: { number: 'asc' }, select: { id: true, number: true, name: true, icon: true, photos: true } }),
    prisma.media.findMany({ orderBy: [{ createdAt: 'desc' }, { key: 'asc' }] }),
  ]);
  const byKey = new Map(media.map((m) => [m.key, m]));
  const usedBy = new Map<string, string[]>();
  for (const r of rooms) for (const k of r.photos) usedBy.set(k, [...(usedBy.get(k) ?? []), r.name]);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Photos</p>
          <h1 className="h1">
            The rooms, <em>in pictures</em>
          </h1>
          <p className="lede">
            Each room’s first photo is its cover on the website. Photos are resized to 1200 pixels and compressed, so a phone photo is fine.
          </p>
        </div>
      </div>

      <section className="stack" aria-label="Rooms">
        {rooms.map((room) => {
          const missing = media.filter((m) => !room.photos.includes(m.key));
          return (
            <article className="card" key={room.id}>
              <h2 className="card__title">
                <Icon name={room.icon as IconName} className="card__icon" /> {room.number} · {room.name}
              </h2>
              <ActionForm action={editRoomPhotos.bind(null, room.id)} className="stack-sm">
                <ol className="strip">
                  {room.photos.map((key, i) => {
                    const m = byKey.get(key);
                    return (
                      <li key={key} className="strip__item">
                        {m ? <Thumb m={m} /> : <span className="thumb thumb--missing">Missing: {key}</span>}
                        {i === 0 && <span className="strip__cover">Cover</span>}
                        <span className="strip__tools">
                          <Submit name="op" value={`left:${key}`} className="tool" busy="…" disabled={i === 0}>
                            <span aria-hidden="true">←</span>
                            <span className="sr-only">Move earlier</span>
                          </Submit>
                          <Submit name="op" value={`right:${key}`} className="tool" busy="…" disabled={i === room.photos.length - 1}>
                            <span aria-hidden="true">→</span>
                            <span className="sr-only">Move later</span>
                          </Submit>
                          {i > 0 && (
                            <Submit name="op" value={`cover:${key}`} className="tool tool--text strip__push" busy="…">
                              Cover
                            </Submit>
                          )}
                          <Submit name="op" value={`remove:${key}`} className={`tool tool--text${i === 0 ? ' strip__push' : ''}`} busy="…">
                            Remove
                          </Submit>
                        </span>
                      </li>
                    );
                  })}
                </ol>
                {missing.length > 0 && (
                  <div className="inline-form">
                    <label className="field">
                      <span className="field__label">Add from the library</span>
                      <select className="input input--sm" name="add" defaultValue="">
                        <option value="" disabled>
                          Choose a photo
                        </option>
                        {missing.map((m) => (
                          <option key={m.key} value={m.key}>
                            {m.alt || m.key}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Submit name="op" value="add:" className="btn btn--ghost btn--sm" busy="Adding…">
                      Add
                    </Submit>
                  </div>
                )}
              </ActionForm>
            </article>
          );
        })}
      </section>

      <section className="card" id="upload">
        <h2 className="card__title">Upload a photo</h2>
        <ActionForm action={uploadPhoto} className="form-grid" resetOnSuccess>
          <label className="field form-grid__wide">
            <span className="field__label">Photo</span>
            <input className="input input--file" type="file" name="file" accept={ACCEPT} required />
            <span className="field__hint">JPEG, PNG or WebP, up to 15 MB.</span>
          </label>
          <label className="field form-grid__wide">
            <span className="field__label">What it shows</span>
            <input className="input" name="alt" maxLength={200} required placeholder="Morning light across Jala’s bed" />
          </label>
          <label className="field">
            <span className="field__label">Add it to</span>
            <select className="input" name="roomId" defaultValue="">
              <option value="">The library only</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.number} · {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Short name (optional)</span>
            <input className="input" name="name" maxLength={60} placeholder="jala-morning" />
          </label>
          <div className="form-grid__wide">
            <Submit busy="Uploading…">Upload</Submit>
          </div>
        </ActionForm>
      </section>

      <section aria-labelledby="library">
        <h2 className="h2" id="library">
          Library <span className="count">{media.length}</span>
        </h2>
        {media.length === 0 ? (
          <p className="empty">No photos yet. Upload the first one above.</p>
        ) : (
          <ul className="library">
            {media.map((m) => {
              const rooms = usedBy.get(m.key);
              const builtIn = m.key in PHOTOS;
              return (
                <li className="library__item" key={m.key}>
                  <Thumb m={m} />
                  <p className="library__meta">
                    <code>{m.key}</code>
                    {rooms ? ` · ${rooms.join(', ')}` : builtIn ? ' · on the website' : ' · not used'}
                  </p>
                  <ActionForm action={saveAlt.bind(null, m.key)} className="inline-form">
                    <label className="field">
                      <span className="sr-only">Description of {m.key}</span>
                      <input className="input input--sm" name="alt" defaultValue={m.alt} maxLength={200} required />
                    </label>
                    <Submit className="btn btn--ghost btn--sm" busy="…">
                      Save
                    </Submit>
                  </ActionForm>
                  <details className="library__more">
                    <summary>Replace or delete</summary>
                    <ActionForm action={replacePhoto.bind(null, m.key)} className="inline-form" resetOnSuccess>
                      <label className="field">
                        <span className="sr-only">New photo for {m.key}</span>
                        <input className="input input--file input--sm" type="file" name="file" accept={ACCEPT} required />
                      </label>
                      <Submit className="btn btn--ghost btn--sm" busy="Uploading…">
                        Replace
                      </Submit>
                    </ActionForm>
                    {!builtIn && !rooms && (
                      <ActionForm action={deletePhoto.bind(null, m.key)} confirm={`Delete ${m.key}? This can’t be undone.`}>
                        <Submit className="btn btn--text btn--sm" busy="Deleting…">
                          Delete photo
                        </Submit>
                      </ActionForm>
                    )}
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
