'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { MessageSquare, SendHorizonal, Shield, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Spinner } from '@/components/ui/feedback';
import {
  isPendingComment,
  useAddComment,
  useRemoveComment,
  useTaskComments,
} from '@/hooks/use-tasks';
import { formatRelative } from '@/lib/format';
import type { Comment } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/store/auth';

const initials = (name: string) =>
  name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

export function CommentThread({ taskId }: { taskId: string }) {
  const me = useAuth((s) => s.user);
  const { data: comments, isLoading } = useTaskComments(taskId);
  const addComment = useAddComment(taskId);
  const removeComment = useRemoveComment(taskId);
  const [body, setBody] = useState('');

  /**
   * Clear the box and post in the background.
   *
   * The comment is already in the thread — the mutation writes it to the cache
   * before the request leaves — so there is nothing to wait for. If the server
   * refuses it, the comment disappears again and a toast says why.
   */
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    addComment.mutate(text);
    setBody('');
  };

  return (
    <div className="mt-7">
      <p className="flex items-center gap-1.5 text-xs text-ink-faint">
        <MessageSquare className="h-3.5 w-3.5" /> Discussion
        {comments && comments.length > 0 && (
          <span className="rounded-full bg-elevated px-1.5 text-[11px] text-ink-soft">{comments.length}</span>
        )}
      </p>

      {/* Thread */}
      <div className="mt-3 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Spinner className="h-4 w-4" />
          </div>
        ) : comments && comments.length > 0 ? (
          <AnimatePresence initial={false}>
            {comments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                // A comment still being saved has no server id to delete by.
                canDelete={!isPendingComment(c.id) && (me?.role === 'ADMIN' || c.author?.id === me?.id)}
                pending={isPendingComment(c.id)}
                onDelete={() => removeComment.mutate(c.id)}
              />
            ))}
          </AnimatePresence>
        ) : (
          <p className="text-sm text-ink-faint">No comments yet — start the conversation.</p>
        )}
      </div>

      {/* Composer */}
      <form onSubmit={submit} className="mt-4">
        <div className="flex items-end gap-2 rounded-2xl border border-line bg-canvas p-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit(e);
            }}
            rows={1}
            placeholder="Write a comment…  (⌘↵ to send)"
            className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-ink outline-none placeholder:text-ink-faint"
          />
          <button
            type="submit"
            disabled={!body.trim()}
            aria-label="Send comment"
            className="flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3 text-sm font-medium text-accent-ink transition-all hover:brightness-105 active:scale-95 disabled:opacity-40"
          >
            <SendHorizonal className="h-4 w-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>
      </form>
    </div>
  );
}

function CommentItem({
  comment,
  canDelete,
  onDelete,
  pending,
}: {
  comment: Comment;
  canDelete: boolean;
  onDelete: () => void;
  /** Written locally, not yet acknowledged by the server. */
  pending?: boolean;
}) {
  const name = comment.author?.name ?? 'Removed user';
  const isAdmin = comment.author?.role === 'ADMIN';
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className={cn('group flex gap-2.5', pending && 'opacity-60')}
    >
      <span
        className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
          isAdmin ? 'bg-accent text-accent-ink' : 'bg-elevated text-ink-soft',
        )}
      >
        {comment.author ? initials(name) : '?'}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink">{name}</span>
          {isAdmin && (
            <span className="inline-flex items-center gap-0.5 rounded-full border border-accent/30 bg-accent/10 px-1.5 text-[10px] text-accent">
              <Shield className="h-2.5 w-2.5" /> admin
            </span>
          )}
          <span className="text-xs text-ink-faint">{formatRelative(comment.createdAt)}</span>
          {canDelete && (
            <button
              onClick={onDelete}
              aria-label="Delete comment"
              className="ml-auto rounded p-1 text-ink-faint opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <p className="mt-0.5 whitespace-pre-wrap text-pretty text-sm text-ink-soft">{comment.body}</p>
      </div>
    </motion.div>
  );
}
