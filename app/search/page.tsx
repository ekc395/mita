import Link from 'next/link';

import { AnimeCard } from '@/components/AnimeCard';
import { searchAnime } from '@/lib/anilist';

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

      <div className="mt-6 space-y-1">
        {results.map((anime) => (
          <AnimeCard key={anime.anilist_id} anime={anime} />
        ))}
      </div>

      {query && results.length === 0 && (
        <p className="mt-6 text-sm text-neutral-500">
          Nothing found for “{query}”.
        </p>
      )}
    </main>
  );
}
