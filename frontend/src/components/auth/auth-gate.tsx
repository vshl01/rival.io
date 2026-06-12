'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Spinner } from '@/components/ui/feedback';
import { useAuth } from '@/store/auth';

/** Runs the session-restore exactly once on app load. Renders nothing. */
export function AuthBootstrap() {
  const bootstrap = useAuth((s) => s.bootstrap);
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);
  return null;
}

/** Full-screen loader shown while we figure out the session. */
function Booting() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="h-6 w-6" />
    </div>
  );
}

/** Guards protected routes — redirects to /login once we know there's no session. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const hydrated = useAuth((s) => s.hydrated);
  const isAuthenticated = useAuth((s) => s.isAuthenticated);

  useEffect(() => {
    if (hydrated && !isAuthenticated) router.replace('/login');
  }, [hydrated, isAuthenticated, router]);

  if (!hydrated) return <Booting />;
  if (!isAuthenticated) return <Booting />;
  return <>{children}</>;
}

/** Guards admin-only routes — sends non-admins back to the dashboard. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const router = useRouter();
  const hydrated = useAuth((s) => s.hydrated);
  const role = useAuth((s) => s.user?.role);

  useEffect(() => {
    if (hydrated && role !== 'ADMIN') router.replace('/dashboard');
  }, [hydrated, role, router]);

  if (!hydrated || role !== 'ADMIN') return <Booting />;
  return <>{children}</>;
}

/** For /login & /signup — bounces authenticated users into the app. */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const router = useRouter();
  const hydrated = useAuth((s) => s.hydrated);
  const isAuthenticated = useAuth((s) => s.isAuthenticated);

  useEffect(() => {
    if (hydrated && isAuthenticated) router.replace('/dashboard');
  }, [hydrated, isAuthenticated, router]);

  return <>{children}</>;
}
