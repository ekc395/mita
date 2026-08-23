'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * Boundary for anything a page throws -- several routes fail loudly by design
 * rather than render an empty list. Next redacts the message in production.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="py-16">
      <h1 className="text-xl font-semibold">Something went wrong</h1>

      <p className="mt-2 text-sm text-neutral-500">
        {error.message || 'An unexpected error occurred.'}
      </p>

      {error.digest && (
        <p className="mt-1 font-mono text-xs text-neutral-400">{error.digest}</p>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={reset}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Try again
        </button>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          Home
        </Link>
      </div>
    </main>
  );
}
