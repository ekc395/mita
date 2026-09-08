import Link from 'next/link';
import { redirect } from 'next/navigation';

import { RankedRow } from '@/components/RankedRow';
import { WantSection } from '@/components/WantSection';
import { createClient } from '@/lib/supabase/server';
import type { AnimeSummary, Sentiment } from '@/lib/types';

interface ListRow {
  anilist_id: number;
  status: string;
  sentiment: Sentiment | null;
  rank_position: number | null;
  score: number | null;
  anime: AnimeSummary | null;
}

export default async function ListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // user_anime is readable for anyone can_view_user() admits, so this needs an
  // explicit user filter. rank_position ordering leaves unranked rows last.
  const { data, error } = await supabase
    .from('user_anime')
    .select(
      'anilist_id, status, sentiment, rank_position, score, anime(title_english, title_romaji, cover_image_url)',
    )
    .eq('user_id', user.id)
    .order('rank_position', { nullsFirst: false });

  // A swallowed error renders as "Nothing logged yet." on a populated list.
  if (error) throw new Error(`Could not load your list: ${error.message}`);

  const rows = (data ?? []) as ListRow[];
  const ranked = rows.filter((row) => row.score !== null);
  const want = rows.filter((row) => row.status === 'want');

  return (
    <main className="py-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Your list</h1>
        <Link href="/search" className="text-sm text-muted-foreground hover:underline">
          Search
        </Link>
      </div>

      {ranked.length === 0 && want.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">
          Nothing logged yet.{' '}
          <Link href="/search" className="underline">
            Find something you have watched.
          </Link>
        </p>
      )}

      {ranked.length > 0 && (
        <ol className="mt-6 space-y-1">
          {ranked.map((row, index) => (
            <RankedRow key={row.anilist_id} row={row} position={index + 1} />
          ))}
        </ol>
      )}

      <WantSection rows={want} />
    </main>
  );
}
