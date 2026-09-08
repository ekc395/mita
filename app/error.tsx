'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';

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

      <p className="mt-2 text-sm text-muted-foreground">
        {error.message || 'An unexpected error occurred.'}
      </p>

      {error.digest && (
        <p className="mt-1 font-mono text-xs text-muted-foreground">{error.digest}</p>
      )}

      <div className="mt-6 flex items-center gap-3">
        <Button variant="outline" onClick={reset}>
          Try again
        </Button>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          Home
        </Link>
      </div>
    </main>
  );
}
