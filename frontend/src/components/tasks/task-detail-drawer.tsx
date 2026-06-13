'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Download, Eye, FileText, Paperclip, Pencil, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PriorityBadge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/feedback';
import {
  useAddAttachment,
  useRemoveAttachment,
  useTask,
  useTaskActivity,
} from '@/hooks/use-tasks';
import { API_URL } from '@/lib/api';
import { formatBytes, formatFullDate } from '@/lib/format';
import type { Attachment } from '@/lib/types';
import { ActivityTimeline } from './activity-timeline';
import { AttachmentPreview } from './attachment-preview';
import { CommentThread } from './comment-thread';
import { ease } from '@/lib/motion';
import { useUi } from '@/store/ui';

export function TaskDetailDrawer() {
  const taskId = useUi((s) => s.detailTaskId);
  const close = useUi((s) => s.closeDetail);
  const openTaskForm = useUi((s) => s.openTaskForm);
  const open = !!taskId;

  const { data: task, isLoading } = useTask(taskId);
  const { data: activities } = useTaskActivity(taskId);
  const addAttachment = useAddAttachment(taskId ?? '');
  const removeAttachment = useRemoveAttachment(taskId ?? '');
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Attachment | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.32, ease }}
            className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-line bg-surface shadow-lift"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <p className="text-eyebrow">Task details</p>
              <button onClick={close} aria-label="Close" className="rounded-lg p-1.5 text-ink-faint hover:bg-elevated hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>

            {isLoading || !task ? (
              <div className="flex flex-1 items-center justify-center">
                <Spinner />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto px-5 py-5">
                <h2 className="font-display text-3xl leading-tight text-ink">{task.title}</h2>

                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusBadge status={task.status} />
                  <PriorityBadge priority={task.priority} />
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-3 border-y border-line py-4 text-sm">
                  <div>
                    <dt className="text-xs text-ink-faint">Due date</dt>
                    <dd className="mt-0.5 text-ink">{task.dueDate ? formatFullDate(task.dueDate).split(' at')[0] : '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-faint">Created</dt>
                    <dd className="mt-0.5 text-ink">{formatFullDate(task.createdAt).split(' at')[0]}</dd>
                  </div>
                </dl>

                {task.description && (
                  <div className="mt-5">
                    <p className="text-xs text-ink-faint">Description</p>
                    <p className="mt-1.5 whitespace-pre-wrap text-pretty text-sm leading-relaxed text-ink-soft">
                      {task.description}
                    </p>
                  </div>
                )}

                {/* Attachments */}
                <div className="mt-6">
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-xs text-ink-faint">
                      <Paperclip className="h-3.5 w-3.5" /> Attachments
                    </p>
                    <button
                      onClick={() => fileInput.current?.click()}
                      className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                    >
                      {addAttachment.isPending ? <Spinner className="h-3 w-3" /> : <Upload className="h-3.5 w-3.5" />}
                      Add
                    </button>
                    <input
                      ref={fileInput}
                      type="file"
                      className="hidden"
                      accept="image/*,application/pdf,.doc,.docx,.txt"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) addAttachment.mutate(file);
                        e.target.value = '';
                      }}
                    />
                  </div>

                  <div className="mt-2 space-y-2">
                    {task.attachments?.length ? (
                      task.attachments.map((a) => (
                        <div key={a.id} className="flex items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2">
                          <FileText className="h-4 w-4 shrink-0 text-ink-faint" />
                          <button onClick={() => setPreview(a)} className="min-w-0 flex-1 text-left" aria-label={`Preview ${a.originalName}`}>
                            <p className="truncate text-sm text-ink hover:text-accent">{a.originalName}</p>
                            <p className="text-xs text-ink-faint">{formatBytes(a.size)}</p>
                          </button>
                          <button onClick={() => setPreview(a)} className="rounded p-1 text-ink-faint hover:text-ink" aria-label="Preview">
                            <Eye className="h-4 w-4" />
                          </button>
                          <a href={`${API_URL}${a.url}`} target="_blank" rel="noreferrer" className="rounded p-1 text-ink-faint hover:text-ink" aria-label="Download">
                            <Download className="h-4 w-4" />
                          </a>
                          <button onClick={() => removeAttachment.mutate(a.id)} className="rounded p-1 text-ink-faint hover:text-danger" aria-label="Remove">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-ink-faint">No attachments yet.</p>
                    )}
                  </div>
                </div>

                {/* Discussion */}
                <CommentThread taskId={task.id} />

                {/* Activity */}
                <div className="mt-7">
                  <p className="text-xs text-ink-faint">Activity</p>
                  <ActivityTimeline activities={activities ?? []} />
                </div>
              </div>
            )}

            {task && (
              <div className="border-t border-line p-4">
                <Button variant="secondary" className="w-full" onClick={() => openTaskForm(task.id)}>
                  <Pencil className="h-4 w-4" /> Edit task
                </Button>
              </div>
            )}
          </motion.aside>

          <AttachmentPreview attachment={preview} onClose={() => setPreview(null)} />
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
