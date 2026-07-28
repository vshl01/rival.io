'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { useCreateOrg } from '@/hooks/use-orgs';

/** Mirrors the backend's slugify() so the preview matches what will be created. */
function previewSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/, '') || 'org'
  );
}

/** Mirrors the backend's deriveKey(): letters only, no leading digits, max 4. */
function previewKey(name: string): string {
  return (
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .replace(/^[0-9]+/, '')
      .slice(0, 4) || 'ORG'
  );
}

interface CreateOrgModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateOrgModal({ open, onClose }: CreateOrgModalProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const createOrg = useCreateOrg();

  // Reset between openings so a cancelled attempt does not linger.
  useEffect(() => {
    if (open) setName('');
  }, [open]);

  const trimmed = name.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < 2;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (trimmed.length < 2) return;
    const org = await createOrg.mutateAsync({ name: trimmed });
    onClose();
    router.push(`/dashboard/${org.slug}`);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New organisation"
      description="You'll be its assigner — you can create sprints and approve who joins."
    >
      <form onSubmit={submit} className="space-y-5 px-6 py-5">
        <div>
          <Label htmlFor="org-name" hint="2–60 characters">
            Name
          </Label>
          <Input
            id="org-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Corp"
            autoFocus
            maxLength={60}
          />
          <FieldError>{tooShort ? 'Give it at least 2 characters' : undefined}</FieldError>
        </div>

        {/* Both are derived server-side; showing them prevents a surprise URL. */}
        {trimmed.length >= 2 && (
          <dl className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-elevated/60 px-4 py-3 text-sm">
            <div>
              <dt className="text-xs text-ink-faint">Address</dt>
              <dd className="mt-0.5 truncate font-mono text-xs text-ink-soft">
                /dashboard/{previewSlug(trimmed)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Ticket keys</dt>
              <dd className="mt-0.5 font-mono text-xs text-ink-soft">{previewKey(trimmed)}-142</dd>
            </div>
          </dl>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={createOrg.isPending} disabled={trimmed.length < 2}>
            Create organisation
          </Button>
        </div>
      </form>
    </Modal>
  );
}
