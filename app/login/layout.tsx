import { Zen_Kaku_Gothic_New, Zen_Old_Mincho } from 'next/font/google';

// Not in the root layout: these faces belong to the sign-in world alone.
const gothic = Zen_Kaku_Gothic_New({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-gothic',
});

const mincho = Zen_Old_Mincho({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-mincho',
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${gothic.variable} ${mincho.variable}`}>{children}</div>;
}
