// Blur-up photo (frontend guide §5). The server sends the 24px placeholder
// with the real dimensions, so the box never shifts; client/images.ts swaps in
// the full WebP when it nears the viewport.

import type { CSSProperties, ImgHTMLAttributes } from 'react';
import { getPhotos } from '@/lib/media';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { k: string } & Record<`data-${string}`, unknown>;

export async function Photo({ k, alt, className, ...rest }: Props) {
  const p = (await getPhotos())[k];
  return (
    // eslint-disable-next-line @next/next/no-img-element -- custom blur-up loader, see client/images.ts
    <img
      className={className ? `blur-img ${className}` : 'blur-img'}
      src={p?.lqip}
      data-img={k}
      width={p?.w}
      height={p?.h}
      alt={alt ?? p?.alt ?? ''}
      decoding="async"
      {...rest}
    />
  );
}

/** A background-image slide (hero) on its placeholder. */
export async function Slide({ k, active = false }: { k: string; active?: boolean }) {
  const p = (await getPhotos())[k];
  const style: CSSProperties | undefined = p ? { backgroundImage: `url("${p.lqip}")` } : undefined;
  return <div className={active ? 'hero__slide is-active' : 'hero__slide'} data-img-bg={k} style={style} />;
}
