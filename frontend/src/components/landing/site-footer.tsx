import { Logo } from '@/components/ui/logo';

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="container-page flex flex-col items-center justify-between gap-6 py-10 sm:flex-row">
        <div className="flex flex-col items-center gap-3 sm:items-start">
          <Logo />
          <p className="text-sm text-ink-faint">Outpace your day.</p>
        </div>
        <nav className="flex items-center gap-6 text-sm text-ink-soft">
          <a href="#features" className="transition-colors hover:text-ink">Features</a>
          <a href="#how" className="transition-colors hover:text-ink">How it works</a>
          <a href="/login" className="transition-colors hover:text-ink">Sign in</a>
        </nav>
        <p className="font-mono text-xs text-ink-faint">© {new Date().getFullYear()} Rival</p>
      </div>
    </footer>
  );
}
