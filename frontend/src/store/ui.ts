'use client';

import { create } from 'zustand';

interface UiState {
  // ⌘K command palette
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;

  // Create / edit task modal (taskId null = create)
  taskForm: { open: boolean; taskId: string | null };
  openTaskForm: (taskId?: string | null) => void;
  closeTaskForm: () => void;

  // Task detail drawer
  detailTaskId: string | null;
  openDetail: (taskId: string) => void;
  closeDetail: () => void;
}

export const useUi = create<UiState>((set) => ({
  commandOpen: false,
  setCommandOpen: (commandOpen) => set({ commandOpen }),

  taskForm: { open: false, taskId: null },
  openTaskForm: (taskId = null) => set({ taskForm: { open: true, taskId } }),
  closeTaskForm: () => set({ taskForm: { open: false, taskId: null } }),

  detailTaskId: null,
  openDetail: (detailTaskId) => set({ detailTaskId }),
  closeDetail: () => set({ detailTaskId: null }),
}));
