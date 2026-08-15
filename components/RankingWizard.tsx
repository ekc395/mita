'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import {
  answerComparison,
  startPlacement,
  type PlacementState,
} from '@/lib/ranking/place';
import { createClient } from '@/lib/supabase/client';
import type { Sentiment } from '@/lib/types';

/** One already-ranked title, as rendered in a head-to-head. */
export interface BucketEntry {
  anilist_id: number;
  title: string;
  cover_image_url: string | null;
}

/** Buckets stack in this order, best block first. */
const SENTIMENTS: { value: Sentiment; label: string }[] = [
  { value: 'liked', label: 'I liked it' },
  { value: 'ok', label: 'It was fine' },
  { value: 'disliked', label: "I didn't like it" },
];

function Poster({ title, cover }: { title: string; cover: string | null }) {
  return (
    <div className="flex flex-col items-center gap-2">
      {cover ? (
        <Image
          src={cover}
          alt=""
          width={112}
          height={160}
          className="h-40 w-28 rounded object-cover"
        />
      ) : (
        <div className="h-40 w-28 rounded bg-neutral-200 dark:bg-neutral-800" />
      )}
      <p className="max-w-28 text-center text-sm font-medium">{title}</p>
    </div>
  );
}

export function RankingWizard({
  anilistId,
  title,
  coverImageUrl,
  buckets,
}: {
  anilistId: number;
  title: string;
  coverImageUrl: string | null;
  /** The viewer's ranked titles per bucket, best first. */
  buckets: Record<Sentiment, BucketEntry[]>;
}) {
  const router = useRouter();
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [placement, setPlacement] = useState<PlacementState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const bucket = sentiment ? buckets[sentiment] : [];

  // State updates are not synchronous: two clicks in one tick would both read
  // the same `placement`, and the second would drop the first's answer.
  const busy = useRef(false);

  // `submitting` is a dep for its false edge, the failed-save retry path. Its
  // true edge releases early, but nothing is clickable then.
  useEffect(() => {
    busy.current = false;
  }, [placement, submitting]);

  async function submit(chosen: Sentiment, bucketIndex: number) {
    setSubmitting(true);
    setError(null);

    // A transport failure rejects rather than returning `error`, and submit()
    // is fired with `void`, so without this the screen sticks on "Saving…".
    try {
      const { error } = await createClient().rpc('set_anime_rank', {
        p_anilist_id: anilistId,
        p_sentiment: chosen,
        p_bucket_index: bucketIndex,
      });

      if (error) {
        setError(error.message);
        setSubmitting(false);
        return;
      }
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
      // Released here rather than via the effect: a synchronous throw would
      // batch both setSubmitting calls, so `submitting` never changes and the
      // effect never re-runs.
      busy.current = false;
      setSubmitting(false);
      return;
    }

    router.push('/list');
    router.refresh();
  }

  function chooseSentiment(chosen: Sentiment) {
    if (busy.current) return;
    busy.current = true;

    setSentiment(chosen);

    // An empty bucket resolves with no questions at all.
    const initial = startPlacement(buckets[chosen].length);
    if (initial.status === 'placed') {
      void submit(chosen, initial.bucketIndex);
      return;
    }
    setPlacement(initial);
  }

  function answer(choice: 'new' | 'existing') {
    if (busy.current) return;
    if (!placement || !sentiment) return;
    busy.current = true;

    const next = answerComparison(placement, choice);
    if (next.status === 'placed') {
      void submit(sentiment, next.bucketIndex);
      return;
    }
    setPlacement(next);
  }

  if (submitting) {
    return <p className="py-16 text-sm text-neutral-500">Saving…</p>;
  }

  if (!sentiment || !placement || placement.status === 'placed') {
    return (
      <div className="py-8">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-neutral-500">What did you think?</p>

        <div className="mt-6 space-y-2">
          {SENTIMENTS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => chooseSentiment(value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-3 text-sm font-medium transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              {label}
            </button>
          ))}
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  const opponent = bucket[placement.probe];

  return (
    <div className="py-8">
      <p className="text-sm text-neutral-500">Which did you like more?</p>

      <div className="mt-8 flex items-start justify-center gap-6">
        <button onClick={() => answer('new')} className="transition-opacity hover:opacity-70">
          <Poster title={title} cover={coverImageUrl} />
        </button>

        <span className="self-center text-sm text-neutral-400">or</span>

        <button
          onClick={() => answer('existing')}
          className="transition-opacity hover:opacity-70"
        >
          <Poster title={opponent.title} cover={opponent.cover_image_url} />
        </button>
      </div>

      {error && <p className="mt-6 text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
