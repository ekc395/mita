import Image from 'next/image';
import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import { animeTitle, type Sentiment } from '@/lib/types';

interface ListRow {
  anilist_id: number;
  status: string;
  sentiment: Sentiment | null;
  rank_position: number | null;
  score: number | null;
  anime: {
    title_english: string | null;
    title_romaji: string | null;
    cover_image_url: string | null;
  } | null;
}

export default async function ListPage() {
  const supabase = await createClient();

  // RLS scopes this to the viewer, so no user filter is needed. Ordering by
  // rank_position gives the ranked block in score order; unranked rows sort
  // last and are split out below.
  const { data } = await supabase
    .from('user_anime')
    .select(
      'anilist_id, status, sentiment, rank_position, score, anime(title_english, title_romaji, cover_image_url)',
    )
    .order('rank_position', { nullsFirst: false });

  const rows = (data ?? []) as ListRow[];
  const ranked = rows.filter((row) => row.score !== null);
  const want = rows.filter((row) => row.status === 'want');

  return (
    <main className="py-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Your list</h1>
        <Link href="/search" className="text-sm text-neutral-500 hover:underline">
          Search
        </Link>
      </div>

      {ranked.length === 0 && want.length === 0 && (
        <p className="mt-6 text-sm text-neutral-500">
          Nothing logged yet.{' '}
          <Link href="/search" className="underline">
            Find something you have watched.
          </Link>
        </p>
      )}

      {ranked.length > 0 && (
        <ol className="mt-6 space-y-1">
          {ranked.map((row, index) => (
            <li key={row.anilist_id}>
              <Link
                href={`/anime/${row.anilist_id}`}
                className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-900"
              >
                <span className="w-5 shrink-0 text-sm text-neutral-400">{index + 1}</span>

                {row.anime?.cover_image_url ? (
                  <Image
                    src={row.anime.cover_image_url}
                    alt=""
                    width={40}
                    height={56}
                    className="h-14 w-10 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="h-14 w-10 shrink-0 rounded bg-neutral-200 dark:bg-neutral-800" />
                )}

                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {row.anime ? animeTitle(row.anime) : 'Unknown'}
                </span>

                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {row.score?.toFixed(1)}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      {want.length > 0 && (
        <>
          <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Want to watch
          </h2>
          <ul className="mt-3 space-y-1">
            {want.map((row) => (
              <li key={row.anilist_id}>
                <Link
                  href={`/anime/${row.anilist_id}`}
                  className="block truncate rounded-lg p-2 text-sm transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-900"
                >
                  {row.anime ? animeTitle(row.anime) : 'Unknown'}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
