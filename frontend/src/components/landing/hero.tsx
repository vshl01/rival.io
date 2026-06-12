'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { KineticHeadline } from '@/components/motion/kinetic-headline';
import { Button } from '@/components/ui/button';
import { blurUp, ease, fadeUp, staggerContainer } from '@/lib/motion';
import { HeroBoard } from './hero-board';

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-20 pt-36 sm:pt-44">
      {/* Ambient accent glow + grid texture */}
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-accent/15 blur-[120px]" />

      <div className="container-page relative">
        <motion.div
          variants={staggerContainer(0.12)}
          initial="hidden"
          animate="visible"
          className="mx-auto max-w-3xl text-center"
        >
          <motion.div variants={fadeUp} className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3.5 py-1.5 text-xs backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <span className="text-ink-soft">Real-time. Optimistic. Yours.</span>
          </motion.div>

          <KineticHeadline
            text="Outpace"
            className="text-[clamp(56px,12vw,132px)] font-medium tracking-[-0.04em] text-ink"
            delay={0.15}
          />
          <div className="-mt-2 flex items-center justify-center gap-3 sm:gap-5">
            <KineticHeadline
              text="your"
              as="h2"
              className="text-[clamp(56px,12vw,132px)] font-medium tracking-[-0.04em] text-ink"
              delay={0.4}
            />
            <motion.span
              initial={{ opacity: 0, y: 24, rotate: -6 }}
              animate={{ opacity: 1, y: 0, rotate: -3 }}
              transition={{ delay: 0.7, duration: 0.7, ease }}
              className="font-display text-[clamp(56px,12vw,132px)] italic leading-[0.95] text-accent"
            >
              day
            </motion.span>
          </div>

          <motion.p
            variants={blurUp}
            className="mx-auto mt-7 max-w-xl text-pretty text-lg text-ink-soft sm:text-xl"
          >
            Rival turns a chaotic backlog into momentum. Capture, prioritise, and
            finish — with a workspace that feels as fast as you think.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup">
              <Button size="lg" className="group w-full sm:w-auto">
                Start for free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Live demo
              </Button>
            </Link>
          </motion.div>
          <motion.p variants={fadeUp} className="mt-4 font-mono text-xs text-ink-faint">
            demo@rival.app · Password123 — no signup needed
          </motion.p>
        </motion.div>

        {/* Floating product preview */}
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.85, duration: 1, ease }}
          className="relative mx-auto mt-16 max-w-4xl"
        >
          <HeroBoard />
        </motion.div>
      </div>
    </section>
  );
}
