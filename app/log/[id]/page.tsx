import { notFound } from 'next/navigation';

import { RankingWizard, type BucketEntry } from '@/components/RankingWizard';
import { getAnime } from '@/lib/anilist';
import { createClient } from '@/lib/supabase/server';
import { animeTitle, type Sentiment } from '@/lib/types';

/** Shape of the joined row below. */
interface RankedRow {
  anilist_id: number;
  sentiment: Sentiment | null;
  anime: {
    title_english: string | null;
    title_romaji: string | null;
    cover_image_url: string | null;
  } | null;
}

export default async function LogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const anilistId = Number(id);

  if (!Number.isInteger(anilistId)) notFound();

  const anime = await getAnime(anilistId);
  if (!anime) notFound();

  // The viewer's ranked titles, best first. RLS scopes this to them, and
  // ordering by rank_position is what the binary search assumes.
  const supabase = await createClient();
  const { data } = await supabase
    .from('user_anime')
    .select('anilist_id, sentiment, anime(title_english, title_romaji, cover_image_url)')
    .not('sentiment', 'is', null)
    .order('rank_position');

  const buckets: Record<Sentiment, BucketEntry[]> = { liked: [], ok: [], disliked: [] };

  for (const row of (data ?? []) as RankedRow[]) {
    // Exclude the title being ranked: re-ranking must not compare it to itself.
    if (!row.sentiment || row.anilist_id === anilistId || !row.anime) continue;

    buckets[row.sentiment].push({
      anilist_id: row.anilist_id,
      title: animeTitle(row.anime),
      cover_image_url: row.anime.cover_image_url,
    });
  }

  return (
    <RankingWizard
      anilistId={anilistId}
      title={animeTitle(anime)}
      coverImageUrl={anime.cover_image_url}
      buckets={buckets}
    />
  );
}
