import Image from 'next/image';

import type { AnimeSummary } from '@/lib/types';

/** Row-sized cover. The placeholder holds the slot so rows stay aligned when
 *  AniList has no art. */
export function PosterThumb({ anime }: { anime: AnimeSummary | null }) {
  if (!anime?.cover_image_url) {
    return <div className="h-14 w-10 shrink-0 rounded bg-muted" />;
  }

  return (
    <Image
      src={anime.cover_image_url}
      alt=""
      width={40}
      height={56}
      className="h-14 w-10 shrink-0 rounded object-cover"
    />
  );
}
