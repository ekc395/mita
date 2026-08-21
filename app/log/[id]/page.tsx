import { notFound, redirect } from 'next/navigation';

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // The user filter is load-bearing: user_anime is readable for anyone
  // can_view_user() admits, so without it the buckets fill with other people's
  // titles. Ordering by rank_position is what the binary search assumes.
  const { data, error } = await supabase
    .from('user_anime')
    .select('anilist_id, sentiment, anime(title_english, title_romaji, cover_image_url)')
    .eq('user_id', user.id)
    .not('sentiment', 'is', null)
    .order('rank_position');

  // A swallowed error empties every bucket, which reads as "nothing ranked
  // yet": the title would land at rank 1 unopposed and silently rescore the list.
  if (error) throw new Error(`Could not load your ranked titles: ${error.message}`);

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
