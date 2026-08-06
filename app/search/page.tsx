import Link from 'next/link';

import { AnimeCard } from '@/components/AnimeCard';
import { searchAnime } from '@/lib/anilist';
import { createClient } from '@/lib/supabase/server';

/**
 * Search is a plain GET form against a Server Component rather than a
 * client-side fetch: the query lives in the URL, so results are shareable and
 * survive a refresh, and searchAnime stays server-only (it writes the cache
 * with the service-role key).
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = '' } = await searchParams;
  const query = q.trim();
  const results = query ? await searchAnime(query) : [];

  // People matching the same box. profiles_select applies can_view_user(), so
  // private profiles the viewer does not follow never appear here.
  const supabase = await createClient();
  const { data: people } = query
    ? await supabase
        .from('profiles')
        .select('username, display_name')
        .not('username', 'is', null)
        .ilike('username', `%${query}%`)
        .limit(5)
    : { data: [] };

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

      <div className="mt-6 space-y-1">
        {results.map((anime) => (
          <AnimeCard key={anime.anilist_id} anime={anime} />
        ))}
      </div>

      {query && results.length === 0 && (people ?? []).length === 0 && (
        <p className="mt-6 text-sm text-neutral-500">
          Nothing found for “{query}”.
        </p>
      )}
    </main>
  );
}
