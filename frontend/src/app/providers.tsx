'use client';

import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { AuthBootstrap } from '@/components/auth/auth-gate';
import { QueryProvider } from '@/providers/query-provider';
import { SocketProvider } from '@/providers/socket-provider';
import { ThemeProvider } from '@/providers/theme-provider';

export function Providers({ children, nonce }: { children: ReactNode; nonce?: string }) {
  return (
    <ThemeProvider nonce={nonce}>
      <QueryProvider>
        <SocketProvider>
          <AuthBootstrap />
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast:
                  '!bg-elevated !text-ink !border !border-line !rounded-xl !shadow-lift !font-sans',
                description: '!text-ink-soft',
              },
            }}
          />
        </SocketProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
