import Link from 'next/link';

import { AnimeCard } from '@/components/AnimeCard';
import { searchAnime } from '@/lib/anilist';
import { createClient } from '@/lib/supabase/server';
import type { Anime } from '@/lib/types';

/**
 * A GET form against a Server Component, not a client fetch: the query lives in
 * the URL (shareable, refresh-safe) and searchAnime stays server-only.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = '' } = await searchParams;
  const query = q.trim();

  // People search is Postgres and survives an AniList outage, so catch here
  // rather than failing the whole route. Covers the cache write too, hence the
  // neutral wording.
  let results: Anime[] = [];
  let titleSearchFailed = false;
  if (query) {
    try {
      results = await searchAnime(query);
    } catch (error) {
      console.error(error);
      titleSearchFailed = true;
    }
  }

  // People matching the same box. profiles_select applies can_view_user(), so
  // private profiles the viewer does not follow never appear here.
  const supabase = await createClient();
  const { data: people, error: peopleError } = query
    ? await supabase
        .from('profiles')
        .select('username, display_name')
        .not('username', 'is', null)
        .ilike('username', `%${query}%`)
        .limit(5)
    : { data: [], error: null };

  // supabase-js returns { data: null, error } instead of throwing, so an
  // unchecked failure here would render as "nothing found" too.
  const peopleSearchFailed = peopleError !== null;
  if (peopleError) console.error(peopleError);

  return (
    <main className="py-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Search</h1>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          Home
        </Link>
      </div>

      <form action="/search" className="mt-6">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search anime…"
          autoComplete="off"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-transparent"
        />
      </form>

      {(people ?? []).length > 0 && (
        <>
          <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            People
          </h2>
          <ul className="mt-3 space-y-1">
            {(people ?? []).map((person) => (
              <li key={person.username}>
                <Link
                  href={`/u/${person.username}`}
                  className="block truncate rounded-lg p-2 text-sm transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-900"
                >
                  <span className="font-medium">
                    {person.display_name ?? `@${person.username}`}
                  </span>
                  {person.display_name && (
                    <span className="ml-2 text-neutral-500">@{person.username}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {titleSearchFailed && (
        <p className="mt-6 text-sm text-red-600">
          Title search is unavailable right now.
          {!peopleSearchFailed && ' People results still work.'}
        </p>
      )}

      {peopleSearchFailed && (
        <p className="mt-6 text-sm text-red-600">
          People search is unavailable right now.
        </p>
      )}

      <div className="mt-6 space-y-1">
        {results.map((anime) => (
          <AnimeCard key={anime.anilist_id} anime={anime} />
        ))}
      </div>

      {query &&
        !titleSearchFailed &&
        !peopleSearchFailed &&
        results.length === 0 &&
        (people ?? []).length === 0 && (
          <p className="mt-6 text-sm text-neutral-500">
            Nothing found for “{query}”.
          </p>
        )}
    </main>
  );
}
