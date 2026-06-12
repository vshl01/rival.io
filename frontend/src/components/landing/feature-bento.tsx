'use client';

import { Activity, KeyboardIcon, Paperclip, Radio, SlidersHorizontal, Undo2 } from 'lucide-react';
import { KineticHeadline } from '@/components/motion/kinetic-headline';
import { Reveal } from '@/components/motion/reveal';
import { cn } from '@/lib/utils';

const FEATURES = [
  {
    icon: Radio,
    title: 'Real-time everywhere',
    body: 'Changes land instantly across every open tab over WebSockets — no refresh, no stale state.',
    span: 'sm:col-span-2',
    accent: true,
  },
  {
    icon: Undo2,
    title: 'Optimistic, with a safety net',
    body: 'Toggle, edit, delete — the UI responds immediately and rolls back gracefully if the server disagrees.',
    span: '',
  },
  {
    icon: SlidersHorizontal,
    title: 'Filter · search · sort, together',
    body: 'Stack a status filter, a title search, and a sort order. They all compose into one query.',
    span: '',
  },
  {
    icon: KeyboardIcon,
    title: 'Command palette',
    body: 'Press ⌘K to create, jump, filter, or flip the theme — without lifting your hands off the keyboard.',
    span: 'sm:col-span-2',
  },
  {
    icon: Paperclip,
    title: 'Attachments',
    body: 'Drop an image or a document straight onto a task.',
    span: '',
  },
  {
    icon: Activity,
    title: 'Every change, logged',
    body: 'A per-task activity trail records who changed what, and when.',
    span: '',
  },
];

export function FeatureBento() {
  return (
    <section id="features" className="container-page scroll-mt-24 py-24 sm:py-32">
      <Reveal className="mb-12 max-w-2xl">
        <p className="text-eyebrow mb-3">Built for momentum</p>
        <KineticHeadline
          text="Everything you need, nothing you don’t."
          as="h2"
          className="text-balance text-4xl font-medium tracking-[-0.03em] text-ink sm:text-5xl"
        />
      </Reveal>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {FEATURES.map((f, i) => {
          const Icon = f.icon;
          return (
            <Reveal key={f.title} delay={i * 0.05} className={cn('h-full', f.span)}>
              <div
                className={cn(
                  'group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface p-6 transition-colors',
                  f.accent ? 'hover:border-accent/50' : 'hover:border-ink-faint/40',
                )}
              >
                {f.accent && (
                  <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/10 blur-2xl transition-opacity group-hover:opacity-100" />
                )}
                <div
                  className={cn(
                    'mb-4 flex h-11 w-11 items-center justify-center rounded-xl border',
                    f.accent
                      ? 'border-accent/30 bg-accent/10 text-accent'
                      : 'border-line bg-elevated text-ink-soft',
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-ink">{f.title}</h3>
                <p className="mt-2 text-pretty text-sm leading-relaxed text-ink-soft">{f.body}</p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
