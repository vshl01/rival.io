'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Reveal } from '@/components/motion/reveal';
import { Button } from '@/components/ui/button';

export function FinalCta() {
  return (
    <section id="showcase" className="container-page scroll-mt-24 py-24 sm:py-32">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border border-line bg-surface px-6 py-16 text-center sm:px-12 sm:py-24">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
          <div className="pointer-events-none absolute -bottom-24 left-1/2 h-64 w-[680px] -translate-x-1/2 rounded-full bg-accent/20 blur-[100px]" />

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 200, damping: 18 }}
            className="relative mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-ink"
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 5l7 7-7 7" />
              <path d="M13 5l7 7-7 7" />
            </svg>
          </motion.div>

          <h2 className="relative mx-auto max-w-2xl text-balance font-display text-4xl leading-[1.05] text-ink sm:text-6xl">
            Your backlog doesn’t stand a <span className="italic text-accent">chance.</span>
          </h2>
          <p className="relative mx-auto mt-5 max-w-md text-pretty text-ink-soft">
            Create an account in seconds, or jump straight into the live demo. It’s free.
          </p>
          <div className="relative mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup">
              <Button size="lg" className="group w-full sm:w-auto">
                Get started
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Try the demo
              </Button>
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
