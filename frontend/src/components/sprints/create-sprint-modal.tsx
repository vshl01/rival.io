'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { useCreateSprint } from '@/hooks/use-sprints';

/** `YYYY-MM-DD` for a date input, from a Date. */
function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Sensible defaults for a new sprint in `cycle` (a `YYYY-MM` key):
 * the 1st of that month to a fortnight later — the shape most sprints take.
 */
function defaultsFor(cycle: string): { startsAt: string; deadline: string } {
  const [year, month] = cycle.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 13);
  return { startsAt: toDateInput(start), deadline: toDateInput(end) };
}

interface CreateSprintModalProps {
  open: boolean;
  onClose: () => void;
  orgSlug: string;
  /** The month this sprint is filed under, e.g. `2026-07`. */
  cycle: string;
  /** Label for that month, e.g. "July 2026". */
  cycleLabel: string;
}

export function CreateSprintModal({
  open,
  onClose,
  orgSlug,
  cycle,
  cycleLabel,
}: CreateSprintModalProps) {
  const [name, setName] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [deadline, setDeadline] = useState('');
  const createSprint = useCreateSprint(orgSlug);

  // Re-seed each time it opens, since the month can differ between openings.
  useEffect(() => {
    if (!open) return;
    const defaults = defaultsFor(cycle);
    setName('');
    setStartsAt(defaults.startsAt);
    setDeadline(defaults.deadline);
  }, [open, cycle]);

  const trimmed = name.trim();
  // Mirrors the server's only date invariant: it must end after it starts.
  const datesInvalid = Boolean(startsAt && deadline && deadline <= startsAt);
  const canSubmit = trimmed.length >= 2 && !!startsAt && !!deadline && !datesInvalid;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    await createSprint.mutateAsync({
      cycle,
      name: trimmed,
      // Dates arrive as YYYY-MM-DD; widen to ISO so the API gets a real instant.
      startsAt: new Date(`${startsAt}T09:00:00.000Z`).toISOString(),
      deadline: new Date(`${deadline}T17:00:00.000Z`).toISOString(),
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New sprint"
      description={`Filed under ${cycleLabel}. Its number is assigned automatically.`}
    >
      <form onSubmit={submit} className="space-y-5 px-6 py-5">
        <div>
          <Label htmlFor="sprint-name" hint="2–80 characters">
            Name
          </Label>
          <Input
            id="sprint-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Onboarding polish"
            autoFocus
            maxLength={80}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="sprint-start">Starts</Label>
            <Input
              id="sprint-start"
              type="date"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="sprint-deadline">Deadline</Label>
            <Input
              id="sprint-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        </div>

        <FieldError>
          {datesInvalid ? 'The deadline must be after the start date' : undefined}
        </FieldError>

        {/* A sprint may run past its month — worth saying, since it looks wrong. */}
        <p className="text-xs text-ink-faint">
          A sprint can end outside {cycleLabel}; the month only decides where it is listed.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={createSprint.isPending} disabled={!canSubmit}>
            Create sprint
          </Button>
        </div>
      </form>
    </Modal>
  );
}
