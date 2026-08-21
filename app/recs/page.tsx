import Link from 'next/link';

/** Placeholder so /recs is a valid route module; see milestone 7 in plan.md. */
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
