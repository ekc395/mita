import Link from 'next/link';

/**
 * Placeholder. Recommendations are milestone 7 in plan.md -- aggregating
 * followed users' high-scored titles the viewer has not logged, plus direct
 * user-to-user recs. This exists so /recs is a valid route module and the
 * build compiles; there is nothing to show until that lands.
 */
export default function RecsPage() {
  return (
    <main className="py-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Recommendations</h1>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          Home
        </Link>
      </div>

      <p className="mt-6 text-sm text-neutral-500">
        Not built yet. Follow people and rank titles in the meantime —
        recommendations are derived from both.
      </p>
    </main>
  );
}
