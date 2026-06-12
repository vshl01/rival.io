'use client';

import { motion } from 'framer-motion';
import { charReveal, ease } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface KineticHeadlineProps {
  text: string;
  className?: string;
  /** Per-character stagger in seconds. */
  stagger?: number;
  delay?: number;
  as?: 'h1' | 'h2';
}

/**
 * Reveals a headline character-by-character from behind a mask — the signature
 * landing-page motion. Each word stays unbroken on its own line via wrapping.
 */
export function KineticHeadline({
  text,
  className,
  stagger = 0.025,
  delay = 0,
  as = 'h1',
}: KineticHeadlineProps) {
  const words = text.split(' ');
  let charIndex = 0;
  const Tag = motion[as];

  return (
    <Tag aria-label={text} className={cn('font-display leading-[0.95]', className)} initial="hidden" animate="visible">
      {words.map((word, w) => (
        <span key={w} className="mr-[0.22em] inline-block whitespace-nowrap">
          {word.split('').map((ch) => {
            const i = charIndex++;
            return (
              <span key={i} className="inline-block overflow-hidden align-bottom" aria-hidden>
                <motion.span
                  className="inline-block will-change-transform"
                  variants={charReveal}
                  custom={delay + i * stagger}
                  transition={{ duration: 0.7, ease }}
                >
                  {ch}
                </motion.span>
              </span>
            );
          })}
        </span>
      ))}
    </Tag>
  );
}
