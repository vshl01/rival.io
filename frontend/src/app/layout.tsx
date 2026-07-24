import type { Metadata, Viewport } from 'next';
import { Inter, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import './globals.css';

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const display = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Rival — outpace your day',
  description:
    'Rival is a kinetic task manager that turns your backlog into momentum. Plan, prioritise, and finish — beautifully.',
  applicationName: 'Rival',
  authors: [{ name: 'Rival' }],
  keywords: ['tasks', 'productivity', 'task manager', 'kanban', 'todo'],
  icons: { icon: '/favicon.svg' },
};

// The nonce in our CSP (src/middleware.ts) is minted per request, so pages must
// be rendered per request too — a prerendered page would ship stale/no nonce and
// every script would be blocked.
export const dynamic = 'force-dynamic';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf7f2' },
    { media: '(prefers-color-scheme: dark)', color: '#0f0e0c' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const nonce = headers().get('x-nonce') ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
  );
}
