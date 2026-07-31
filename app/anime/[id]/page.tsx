import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getAnime } from '@/lib/anilist';
import { createClient } from '@/lib/supabase/server';
import { animeTitle } from '@/lib/types';

export default async function AnimeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const anilistId = Number(id);

  if (!Number.isInteger(anilistId)) notFound();

  const anime = await getAnime(anilistId);
  if (!anime) notFound();

  // Whether the viewer has already logged this. RLS scopes the read to them,
  // so no user filter is needed here.
  const supabase = await createClient();
  const { data: entry } = await supabase
    .from('user_anime')
    .select('status, score')
    .eq('anilist_id', anilistId)
    .maybeSingle();

  return (
    <main className="py-8">
      <Link href="/search" className="text-sm text-neutral-500 hover:underline">
        ← Search
      </Link>

      <div className="mt-6 flex gap-4">
        {anime.cover_image_url && (
          <Image
            src={anime.cover_image_url}
            alt=""
            width={112}
            height={160}
            className="h-40 w-28 shrink-0 rounded object-cover"
          />
        )}

        <div className="min-w-0">
          <h1 className="text-xl font-semibold">{animeTitle(anime)}</h1>
          {anime.title_romaji && anime.title_english && (
            <p className="mt-1 text-sm text-neutral-500">{anime.title_romaji}</p>
          )}
          <p className="mt-2 text-sm text-neutral-500">
            {[anime.format, anime.season_year, anime.episodes && `${anime.episodes} eps`]
              .filter(Boolean)
              .join(' · ')}
          </p>

          {entry?.score != null ? (
            <p className="mt-3 text-sm font-medium">Your score: {entry.score}</p>
          ) : entry ? (
            <p className="mt-3 text-sm text-neutral-500">On your list: {entry.status}</p>
          ) : null}
        </div>
      </div>

      {anime.genres.length > 0 && (
        <p className="mt-6 text-sm text-neutral-500">{anime.genres.join(', ')}</p>
      )}

      {anime.description && (
        <p className="mt-4 whitespace-pre-line text-sm leading-relaxed">
          {anime.description}
        </p>
      )}
    </main>
  );
}
