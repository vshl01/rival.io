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
 * First and last day of a cycle month, as date-input values.
 *
 * A sprint must START inside the month it is filed under — day 0 of the next
 * month is the last day of this one, which also handles February and leap years
 * without a table of month lengths.
 */
function monthBounds(cycle: string): { first: string; last: string } {
  const [year, month] = cycle.split('-').map(Number);
  return {
    first: toDateInput(new Date(Date.UTC(year, month - 1, 1))),
    last: toDateInput(new Date(Date.UTC(year, month, 0))),
  };
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

  const bounds = monthBounds(cycle);
  const trimmed = name.trim();

  /*
    Both server rules, checked here so they are visible before submitting:
    the sprint must start inside its own month, and must end after it starts.
    ISO date strings compare correctly as plain strings, so no parsing is needed.
  */
  const startsOutsideMonth = Boolean(startsAt) && (startsAt < bounds.first || startsAt > bounds.last);
  const endsBeforeItStarts = Boolean(startsAt && deadline) && deadline <= startsAt;
  const problem = startsOutsideMonth
    ? `A sprint filed under ${cycleLabel} has to start in ${cycleLabel} — open the right month to plan later work.`
    : endsBeforeItStarts
      ? 'The deadline must be after the start date'
      : undefined;

  const canSubmit = trimmed.length >= 2 && !!startsAt && !!deadline && !problem;

  /**
   * Close at once — the sprint is already in its month block, waiting only for
   * the number the server assigns. A refusal removes it again with a toast.
   */
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    createSprint.mutate({
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
            <Label htmlFor="sprint-start" hint={`in ${cycleLabel}`}>
              Starts
            </Label>
            {/* The picker itself refuses other months, so the rule is felt rather
                than read — the message below is only for a typed-in date. */}
            <Input
              id="sprint-start"
              type="date"
              value={startsAt}
              min={bounds.first}
              max={bounds.last}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="sprint-deadline" hint="may run later">
              Deadline
            </Label>
            <Input
              id="sprint-deadline"
              type="date"
              value={deadline}
              min={startsAt || undefined}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        </div>

        <FieldError>{problem}</FieldError>

        <p className="text-xs text-ink-faint">
          It must start in {cycleLabel} — that is what files it under this month — but it may end
          later.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            Create sprint
          </Button>
        </div>
      </form>
    </Modal>
  );
}
