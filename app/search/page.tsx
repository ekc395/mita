import Link from 'next/link';

import { AnimeCard } from '@/components/AnimeCard';
import { searchAnime } from '@/lib/anilist';
import { createClient } from '@/lib/supabase/server';
import type { Anime } from '@/lib/types';
import { Input } from '@/components/ui/Input';
import { SectionHeading } from '@/components/ui/SectionHeading';

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

  // Catch here, not at the route: people search is Postgres and survives an
  // AniList outage. Neutral wording covers the cache write too; null signals
  // failure, [] an empty result.
  //
  // profiles_select applies can_view_user(), so private profiles never appear.
  const supabase = await createClient();
  const [titleResults, { data: peopleRows, error: peopleError }] = await Promise.all([
    query
      ? searchAnime(query).catch((error) => {
          console.error(error);
          return null;
        })
      : Promise.resolve<Anime[]>([]),
    query
      ? supabase
          .from('profiles')
          .select('username, display_name')
          .not('username', 'is', null)
          .ilike('username', `%${query}%`)
          .limit(5)
      : { data: [], error: null },
  ]);

  const titleSearchFailed = titleResults === null;
  const results = titleResults ?? [];
  const people = peopleRows ?? [];

  // supabase-js returns { data: null, error } instead of throwing, so an
  // unchecked failure here would render as "nothing found" too.
  const peopleSearchFailed = peopleError !== null;
  if (peopleError) console.error(peopleError);

  return (
    <main className="py-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Search</h1>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          Home
        </Link>
      </div>

      <form action="/search" className="mt-6">
        <Input
          name="q"
          defaultValue={query}
          placeholder="Search anime or people…"
          autoComplete="off"
        />
      </form>

      {!query && (
        <p className="mt-4 text-sm text-muted-foreground">
          One box for both: search a title to log it, or a username to follow someone.
        </p>
      )}

      {people.length > 0 && (
        <>
          <SectionHeading className="mt-6">People</SectionHeading>
          <ul className="mt-3 space-y-1">
            {people.map((person) => (
              <li key={person.username}>
                <Link
                  href={`/u/${person.username}`}
                  className="block truncate rounded-lg p-2 text-sm transition-colors hover:bg-accent"
                >
                  <span className="font-medium">
                    {person.display_name ?? `@${person.username}`}
                  </span>
                  {person.display_name && (
                    <span className="ml-2 text-muted-foreground">@{person.username}</span>
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

      {results.length > 0 && (
        <>
          {/* Headed to match People, so neither section reads as an afterthought. */}
          <SectionHeading className="mt-6">Anime</SectionHeading>
          <div className="mt-3 space-y-1">
            {results.map((anime) => (
              <AnimeCard key={anime.anilist_id} anime={anime} />
            ))}
          </div>
        </>
      )}

      {query &&
        !titleSearchFailed &&
        !peopleSearchFailed &&
        results.length === 0 &&
        people.length === 0 && (
          <p className="mt-6 text-sm text-muted-foreground">
            Nothing found for “{query}”.
          </p>
        )}
    </main>
  );
}
