import {
  ArrowDown,
  ArrowUp,
  Ban,
  Circle,
  CircleDashed,
  CircleDot,
  CheckCircle2,
  Flame,
  Lightbulb,
  Minus,
  OctagonAlert,
  type LucideIcon,
} from "lucide-react";
import type { Priority, SortField, TaskStatus } from "./types";

/**
 * One entry per workflow state.
 *
 * `column` tints the board's column header, `accent` is the card's left edge —
 * together they let you read a board's shape without reading any text.
 */
export const STATUS_META: Record<
  TaskStatus,
  {
    label: string;
    icon: LucideIcon;
    dot: string;
    chip: string;
    column: string;
    accent: string;
  }
> = {
  SCOPING: {
    label: "Scoping",
    icon: Lightbulb,
    dot: "bg-low",
    chip: "text-low border-low/30 bg-low/10",
    column: "border-low/25 bg-low/[0.04]",
    accent: "bg-low",
  },
  TODO: {
    label: "To do",
    icon: CircleDashed,
    dot: "bg-ink-faint",
    chip: "text-ink-soft border-line",
    column: "border-line bg-elevated/40",
    accent: "bg-ink-faint",
  },
  IN_PROGRESS: {
    label: "In progress",
    icon: CircleDot,
    dot: "bg-medium",
    chip: "text-medium border-medium/30 bg-medium/10",
    column: "border-medium/25 bg-medium/[0.05]",
    accent: "bg-medium",
  },
  BLOCKED: {
    label: "Blocked",
    icon: OctagonAlert,
    dot: "bg-urgent",
    chip: "text-urgent border-urgent/30 bg-urgent/10",
    column: "border-urgent/30 bg-urgent/[0.06]",
    accent: "bg-urgent",
  },
  DONE: {
    label: "Done",
    icon: CheckCircle2,
    dot: "bg-accent",
    chip: "text-accent border-accent/30 bg-accent/10",
    column: "border-accent/25 bg-accent/[0.05]",
    accent: "bg-accent",
  },
  REMOVED: {
    label: "Removed",
    icon: Ban,
    dot: "bg-ink-faint",
    chip: "text-ink-faint border-line bg-elevated line-through",
    column: "border-line bg-elevated/30",
    accent: "bg-ink-faint",
  },
};

export const PRIORITY_META: Record<
  Priority,
  { label: string; icon: LucideIcon; text: string; chip: string; rank: number }
> = {
  LOW: {
    label: "Low",
    icon: ArrowDown,
    text: "text-low",
    chip: "text-low border-low/30 bg-low/10",
    rank: 0,
  },
  MEDIUM: {
    label: "Medium",
    icon: Minus,
    text: "text-medium",
    chip: "text-medium border-medium/30 bg-medium/10",
    rank: 1,
  },
  HIGH: {
    label: "High",
    icon: ArrowUp,
    text: "text-high",
    chip: "text-high border-high/30 bg-high/10",
    rank: 2,
  },
  URGENT: {
    label: "Urgent",
    icon: Flame,
    text: "text-urgent",
    chip: "text-urgent border-urgent/30 bg-urgent/10",
    rank: 3,
  },
};

/**
 * Board column order. Declared here rather than derived from the enum, because
 * Postgres appends newly added enum values to the END of its own ordering — so
 * the database's order would read SCOPING and BLOCKED after DONE.
 */
export const STATUS_ORDER: TaskStatus[] = [
  "SCOPING",
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "DONE",
  "REMOVED",
];

/** The states shown as columns by default — REMOVED is collapsed out of the way. */
export const BOARD_COLUMNS: TaskStatus[] = [
  "SCOPING",
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "DONE",
];
export const PRIORITY_ORDER: Priority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];

export const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "createdAt", label: "Created" },
  { value: "dueDate", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "updatedAt", label: "Updated" },
  { value: "title", label: "Title" },
];

export { Circle };
