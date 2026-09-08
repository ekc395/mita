'use client';

import { useState } from 'react';

import { createClient } from '@/lib/supabase/client';

export type MagicLinkStatus = 'idle' | 'sending' | 'sent';

/** The magic-link exchange, with no opinion about how it looks -- the caller owns the markup. */
export function useMagicLink() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<MagicLinkStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setStatus('sending');
    setError(null);

    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setError(error.message);
      setStatus('idle');
      return;
    }

    setStatus('sent');
  }

  return { email, setEmail, status, error, send };
}
