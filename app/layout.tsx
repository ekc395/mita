import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'mita',
  description: 'Rank the anime you watch, head to head.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="mx-auto min-h-screen max-w-2xl px-4 py-6">{children}</div>
      </body>
    </html>
  );
}
