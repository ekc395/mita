'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

/** Someone the viewer follows, and so may recommend to. */
export interface Recipient {
  id: string;
  username: string | null;
  display_name: string | null;
}

function recipientName(person: Recipient): string {
  return person.display_name ?? (person.username ? `@${person.username}` : 'Someone');
}

/**
 * Send a title to someone you follow. viewerId is a prop for the same reason
 * FollowButton takes one, and is equally safe -- RLS requires it to equal
 * auth.uid().
 */
export function RecommendButton({
  viewerId,
  anilistId,
  people,
}: {
  viewerId: string;
  anilistId: number;
  people: Recipient[];
}) {
  const router = useRouter();
  const [chosenId, setChosenId] = useState(people[0]?.id ?? '');

  // `people` can change under us -- router.refresh() after a send re-renders with
  // whatever the follow set is now. Deriving rather than trusting state keeps the
  // picker and the insert on the same person; a stale id would otherwise leave
  // the select blank while the button still sent to the vanished recipient.
  const recipientId = people.some((person) => person.id === chosenId)
    ? chosenId
    : (people[0]?.id ?? '');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  // See RankingWizard's `busy`: two clicks in one tick would both write.
  const busy = useRef(false);

  async function send() {
    if (busy.current) return;
    busy.current = true;

    setPending(true);
    setError(null);
    // Or a failed re-send shows "Sent to Ben" and "already recommended" together.
    setSentTo(null);

    const recipient = people.find((person) => person.id === recipientId);

    try {
      const { error } = await createClient().from('recommendations').insert({
        from_user: viewerId,
        to_user: recipientId,
        anilist_id: anilistId,
        note: note.trim() || null,
      });

      if (error) {
        // 23505 is the (from_user, to_user, anilist_id) unique constraint: a
        // repeat send, which deserves prose rather than a raw Postgres message.
        setError(
          error.code === '23505'
            ? `You have already recommended this to ${recipient ? recipientName(recipient) : 'them'}.`
            : error.message,
        );
        return;
      }

      setSentTo(recipient ? recipientName(recipient) : 'them');
      setNote('');
      // A trigger writes the feed row, so the sender's own activity is stale
      // until the server re-renders.
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setPending(false);
      busy.current = false;
    }
  }

  if (people.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Follow someone to recommend this to them.</p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <select
          value={recipientId}
          // Disabled while sending: `recipient` is captured before the await, so
          // switching mid-flight would report "Sent to Ben" under a picker
          // reading "Ana".
          disabled={pending}
          onChange={(event) => {
            setChosenId(event.target.value);
            setSentTo(null);
          }}
          className="min-w-0 flex-1 rounded-lg border border-border bg-transparent px-3 py-2 text-sm disabled:opacity-50"
        >
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {recipientName(person)}
            </option>
          ))}
        </select>

        <button
          onClick={send}
          disabled={pending}
          className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Sending…' : 'Recommend'}
        </button>
      </div>

      <input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        // Matches the recommendations_note_len check added in 0008; without it
        // the database rejects a long note only after a round trip.
        maxLength={300}
        placeholder="Add a note (optional)"
        className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground"
      />

      {sentTo && <p className="text-sm text-muted-foreground">Sent to {sentTo}.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
