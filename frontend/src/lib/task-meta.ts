import {
  ArrowDown,
  ArrowUp,
  Circle,
  CircleDashed,
  CircleDot,
  CheckCircle2,
  Flame,
  Minus,
  type LucideIcon,
} from "lucide-react";
import type { Priority, SortField, TaskStatus } from "./types";

export const STATUS_META: Record<
  TaskStatus,
  { label: string; icon: LucideIcon; dot: string; chip: string }
> = {
  TODO: {
    label: "To do",
    icon: CircleDashed,
    dot: "bg-ink-faint",
    chip: "text-ink-soft border-line",
  },
  IN_PROGRESS: {
    label: "In progress",
    icon: CircleDot,
    dot: "bg-medium",
    chip: "text-medium border-medium/30 bg-medium/10",
  },
  DONE: {
    label: "Done",
    icon: CheckCircle2,
    dot: "bg-accent",
    chip: "text-accent border-accent/30 bg-accent/10",
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

export const STATUS_ORDER: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];
export const PRIORITY_ORDER: Priority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];

export const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "createdAt", label: "Created" },
  { value: "dueDate", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "updatedAt", label: "Updated" },
  { value: "title", label: "Title" },
];

export { Circle };
