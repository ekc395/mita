import Link from 'next/link';

import { SectionHeading } from '@/components/ui/SectionHeading';
import { animeTitle, type AnimeSummary } from '@/lib/types';

export interface WantEntry {
  anilist_id: number;
  anime: AnimeSummary | null;
}

/** The want-to-watch block, identical on your own list and on a profile. */
export function WantSection({ rows }: { rows: WantEntry[] }) {
  if (rows.length === 0) return null;

  return (
    <>
      <SectionHeading className="mt-10">Want to watch</SectionHeading>
      <ul className="mt-3 space-y-1">
        {rows.map((row) => (
          <li key={row.anilist_id}>
            <Link
              href={`/anime/${row.anilist_id}`}
              className="block truncate rounded-lg p-2 text-sm transition-colors hover:bg-accent"
            >
              {row.anime ? animeTitle(row.anime) : 'Unknown'}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
