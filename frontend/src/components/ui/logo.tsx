import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Rival wordmark. The chevron mark doubles as a "fast-forward / outpace" glyph.
 */
export function Logo({ href = '/', className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn('group inline-flex items-center gap-2', className)} aria-label="Rival home">
      <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-ink">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 5l7 7-7 7" />
          <path d="M13 5l7 7-7 7" />
        </svg>
      </span>
      <span className="text-lg font-semibold tracking-tight text-ink">
        Rival
      </span>
    </Link>
  );
}
