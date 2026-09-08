import Link from 'next/link';

import { PosterThumb } from '@/components/PosterThumb';
import { animeTitle, type AnimeSummary } from '@/lib/types';

/** Only the columns a row renders -- callers pass richer rows straight in. */
export interface RankedEntry {
  anilist_id: number;
  score: number | null;
  anime: AnimeSummary | null;
}

/** One row of a ranked list: position, cover, title, score. */
export function RankedRow({ row, position }: { row: RankedEntry; position: number }) {
  return (
    <li>
      <Link
        href={`/anime/${row.anilist_id}`}
        className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-accent"
      >
        <span className="w-5 shrink-0 text-sm text-muted-foreground">{position}</span>

        <PosterThumb anime={row.anime} />

        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {row.anime ? animeTitle(row.anime) : 'Unknown'}
        </span>

        <span className="shrink-0 text-sm font-semibold tabular-nums">
          {row.score?.toFixed(1)}
        </span>
      </Link>
    </li>
  );
}
