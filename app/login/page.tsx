'use client';

import { SigninButton } from '@/components/signin/SigninButton';
import { SigninCard } from '@/components/signin/SigninCard';
import { SigninError } from '@/components/signin/SigninError';
import { SigninField } from '@/components/signin/SigninField';
import { SigninHero } from '@/components/signin/SigninHero';
import { useMagicLink } from '@/lib/hooks/useMagicLink';

export default function LoginPage() {
  const { email, setEmail, status, error, send } = useMagicLink();

  if (status === 'sent') {
    return (
      <SigninHero>
        <SigninCard title="Check" reading="確認">
          <p className="signin-body">
            We sent a sign-in link to <strong>{email}</strong>. Open it on this device to continue.
          </p>
          <p className="signin-foot">Nothing arrived? Check spam, or reload to try another address.</p>
        </SigninCard>
      </SigninHero>
    );
  }

  return (
    <SigninHero>
      <SigninCard title="mita" reading="見た">
        <form onSubmit={send}>
          <SigninField
            id="email"
            label="Email address"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />

          <SigninButton type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? 'Sending…' : 'Send sign-in link'}
          </SigninButton>

          {error && <SigninError>{error}</SigninError>}
        </form>

        <p className="signin-foot">A link arrives by email.</p>
      </SigninCard>
    </SigninHero>
  );
}
