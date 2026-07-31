'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { createClient } from '@/lib/supabase/client';

/** Mirrors the profiles_username_format check in 0001_init.sql. */
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export default function OnboardingPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!USERNAME_PATTERN.test(username)) {
      setError('3-20 characters, lowercase letters, numbers and underscores only.');
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace('/login');
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ username })
      .eq('id', user.id);

    if (error) {
      // 23505 is unique_violation -- the only failure worth explaining.
      setError(error.code === '23505' ? 'That username is taken.' : error.message);
      setSaving(false);
      return;
    }

    router.replace('/');
    router.refresh();
  }

  return (
    <main className="py-16">
      <h1 className="text-2xl font-semibold">Pick a username</h1>
      <p className="mt-2 text-sm text-neutral-500">
        This is how friends will find you. You can&apos;t change it later.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-3">
        <input
          required
          autoFocus
          value={username}
          onChange={(event) => setUsername(event.target.value.toLowerCase())}
          placeholder="frieren_fan"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-transparent"
        />

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {saving ? 'Saving…' : 'Continue'}
        </button>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </main>
  );
}
