import Image from 'next/image';
import Link from 'next/link';

import { animeTitle, type Anime } from '@/lib/types';

/** Compact metadata line: "TV · 2023 · 28 eps", skipping whatever is missing. */
function subtitle(anime: Anime): string {
  return [
    anime.format,
    anime.season_year,
    anime.episodes ? `${anime.episodes} eps` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function AnimeCard({ anime }: { anime: Anime }) {
  return (
    <Link
      href={`/anime/${anime.anilist_id}`}
      className="flex gap-3 rounded-lg p-2 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-900"
    >
      {anime.cover_image_url ? (
        <Image
          src={anime.cover_image_url}
          alt=""
          width={56}
          height={80}
          className="h-20 w-14 shrink-0 rounded object-cover"
        />
      ) : (
        <div className="h-20 w-14 shrink-0 rounded bg-neutral-200 dark:bg-neutral-800" />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{animeTitle(anime)}</p>
        <p className="mt-0.5 text-sm text-neutral-500">{subtitle(anime)}</p>
        {anime.average_score !== null && (
          <p className="mt-1 text-xs text-neutral-400">
            {anime.average_score}% on AniList
          </p>
        )}
      </div>
    </Link>
  );
}
