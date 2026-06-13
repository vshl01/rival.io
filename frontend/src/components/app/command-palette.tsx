'use client';

import { Command } from 'cmdk';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutGrid, LogOut, Moon, Plus, Shield, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/store/auth';
import { useUi } from '@/store/ui';

export function CommandPalette() {
  const open = useUi((s) => s.commandOpen);
  const setOpen = useUi((s) => s.setCommandOpen);
  const openTaskForm = useUi((s) => s.openTaskForm);
  const role = useAuth((s) => s.user?.role);
  const logout = useAuth((s) => s.logout);
  const router = useRouter();
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();

  // Navigate, but if we're already on the target route just close the palette
  // and scroll to top — so an item never feels like it "did nothing".
  const goTo = (href: string) => () => {
    setOpen(false);
    if (pathname === href) window.scrollTo({ top: 0, behavior: 'smooth' });
    else router.push(href);
  };

  // Global ⌘K / Ctrl+K toggle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!open);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]">
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="relative z-10 w-full max-w-xl"
          >
            <Command
              loop
              className="overflow-hidden rounded-2xl border border-line bg-surface shadow-lift"
            >
              <Command.Input
                autoFocus
                placeholder="Type a command or search…"
                className="w-full border-b border-line bg-transparent px-5 py-4 text-base text-ink outline-none placeholder:text-ink-faint"
              />
              <Command.List className="max-h-[340px] overflow-y-auto p-2">
                <Command.Empty className="px-3 py-8 text-center text-sm text-ink-faint">
                  No results.
                </Command.Empty>

                <Command.Group heading="Actions" className="px-1 pb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-eyebrow">
                  <Item onSelect={run(() => openTaskForm())} icon={<Plus className="h-4 w-4" />} label="New task" shortcut="N" />
                  <Item
                    onSelect={run(() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'))}
                    icon={resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
                  />
                </Command.Group>

                {(pathname !== '/dashboard' || role === 'ADMIN') && (
                  <Command.Group heading="Go to" className="px-1 pb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-eyebrow">
                    {pathname !== '/dashboard' && (
                      <Item onSelect={goTo('/dashboard')} icon={<LayoutGrid className="h-4 w-4" />} label="Tasks" />
                    )}
                    {role === 'ADMIN' && pathname !== '/admin' && (
                      <Item onSelect={goTo('/admin')} icon={<Shield className="h-4 w-4" />} label="Admin console" />
                    )}
                  </Command.Group>
                )}

                <Command.Group heading="Account" className="px-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-eyebrow">
                  <Item onSelect={run(async () => { await logout(); router.replace('/login'); })} icon={<LogOut className="h-4 w-4" />} label="Sign out" />
                </Command.Group>
              </Command.List>
            </Command>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Item({
  onSelect,
  icon,
  label,
  shortcut,
}: {
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-soft aria-selected:bg-elevated aria-selected:text-ink"
    >
      <span className="text-ink-faint">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && (
        <kbd className="rounded border border-line bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-ink-faint">
          {shortcut}
        </kbd>
      )}
    </Command.Item>
  );
}
