import type { ReactNode } from 'react';
import { RedirectIfAuthenticated } from '@/components/auth/auth-gate';
import { AuthAside } from '@/components/auth/auth-aside';
import { Logo } from '@/components/ui/logo';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <RedirectIfAuthenticated>
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Form column */}
        <div className="relative flex flex-col px-5 py-6 sm:px-10">
          <div className="flex items-center justify-between">
            <Logo />
            <ThemeToggle />
          </div>
          <div className="flex flex-1 items-center justify-center py-10">
            <div className="w-full max-w-sm">{children}</div>
          </div>
        </div>

        {/* Brand column (hidden on small screens) */}
        <AuthAside />
      </div>
    </RedirectIfAuthenticated>
  );
}
