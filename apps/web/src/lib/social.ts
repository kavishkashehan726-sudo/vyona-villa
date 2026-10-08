import { SOCIAL_LABELS, type Social } from '@vyona/core';
import type { IconName } from '@vyona/ui';

export const SOCIAL_ICON: Record<Social, IconName> = {
  instagram: 'insta',
  facebook: 'facebook',
  tiktok: 'tiktok',
  youtube: 'youtube',
  tripadvisor: 'tripadvisor',
};

/** "https://instagram.com/vyona.weligama/" → "@vyona.weligama"; the network's name when there is no handle. */
export function socialText(key: Social, url: string) {
  if (key === 'tripadvisor') return SOCIAL_LABELS[key];
  try {
    const seg = new URL(url).pathname.split('/').filter(Boolean).pop();
    return seg ? `@${decodeURIComponent(seg).replace(/^@/, '')}` : SOCIAL_LABELS[key];
  } catch {
    return SOCIAL_LABELS[key];
  }
}
