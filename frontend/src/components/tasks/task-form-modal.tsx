'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label, Select, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/feedback';
import { useCreateTask, useTask, useUpdateTask } from '@/hooks/use-tasks';
import { PRIORITY_ORDER, STATUS_ORDER, PRIORITY_META, STATUS_META } from '@/lib/task-meta';
import type { TaskStatus } from '@/lib/types';
import { useUi } from '@/store/ui';

const schema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(5000).optional(),
  // Kept in step with STATUS_ORDER so a new workflow state needs one edit.
  status: z.enum(STATUS_ORDER as [TaskStatus, ...TaskStatus[]]),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  dueDate: z.string().optional(),
});
type Values = z.infer<typeof schema>;

const DEFAULTS: Values = { title: '', description: '', status: 'TODO', priority: 'MEDIUM', dueDate: '' };

/** ISO -> yyyy-mm-dd for <input type="date">. */
const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

export function TaskFormModal() {
  const { open, taskId } = useUi((s) => s.taskForm);
  const close = useUi((s) => s.closeTaskForm);
  const isEdit = !!taskId;

  const { data: task, isLoading } = useTask(open && isEdit ? taskId : null);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });

  // Prefill on edit; reset to blank on create.
  useEffect(() => {
    if (!open) return;
    if (isEdit && task) {
      reset({
        title: task.title,
        description: task.description ?? '',
        status: task.status,
        priority: task.priority,
        dueDate: toDateInput(task.dueDate),
      });
    } else if (!isEdit) {
      reset(DEFAULTS);
    }
  }, [open, isEdit, task, reset]);

  /**
   * Close immediately and let the mutation finish in the background.
   *
   * Both mutations write the change into the cache before the request goes out,
   * so the list is already correct behind this modal — holding it open on a
   * spinner would only hide a result the user can already see. A failure rolls
   * the cache back and says why in a toast.
   */
  const onSubmit = (values: Values) => {
    const payload = {
      title: values.title,
      description: values.description?.trim() ? values.description.trim() : null,
      status: values.status,
      priority: values.priority,
      dueDate: values.dueDate ? values.dueDate : null,
    };
    if (isEdit && taskId) updateTask.mutate({ id: taskId, payload });
    else createTask.mutate(payload);
    close();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={isEdit ? 'Edit task' : 'New task'}
      description={isEdit ? 'Update the details below.' : 'What needs to get done?'}
    >
      {isEdit && isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 px-6 py-6" noValidate>
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" placeholder="e.g. Ship the onboarding flow" autoFocus {...register('title')} />
            <FieldError>{errors.title?.message}</FieldError>
          </div>

          <div>
            <Label htmlFor="description" hint="optional">Description</Label>
            <Textarea id="description" placeholder="Add context, links, or acceptance criteria…" {...register('description')} />
            <FieldError>{errors.description?.message}</FieldError>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select id="status" {...register('status')}>
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>{STATUS_META[s].label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select id="priority" {...register('priority')}>
                {PRIORITY_ORDER.map((p) => (
                  <option key={p} value={p}>{PRIORITY_META[p].label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="dueDate" hint="optional">Due date</Label>
              <Input id="dueDate" type="date" {...register('dueDate')} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit">
              {isEdit ? 'Save changes' : 'Create task'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
