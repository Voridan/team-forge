import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ApiError } from '@/api/client';
import type { TaskStatus } from '@/api/types';
import { useCreateTask } from './queries';

interface TaskQuickAddProps {
  teamId: string;
  status: TaskStatus;
}

export function TaskQuickAdd({ teamId, status }: TaskQuickAddProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const createTask = useCreateTask(teamId);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    setTitle('');
  };

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    createTask.mutate(
      { title: trimmed, status },
      {
        onSuccess: () => {
          setTitle('');
          // keep input open so user can keep adding quickly
          inputRef.current?.focus();
        },
        onError: (err) => {
          const msg = err instanceof ApiError ? err.problem.detail ?? err.problem.title : 'Failed';
          toast.error(msg);
        },
      },
    );
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'group mt-2 inline-flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors',
          'hover:bg-secondary hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        <Plus className="size-3.5" />
        Add task
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-lg border bg-card p-2 shadow-sm">
      <Textarea
        ref={inputRef}
        rows={2}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            close();
          }
        }}
        onBlur={() => {
          if (!title.trim()) close();
        }}
        placeholder="What needs to be done?"
        className="min-h-0 resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
      />
      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>
          Press <kbd className="rounded bg-secondary px-1 font-mono">↵</kbd> to save,{' '}
          <kbd className="rounded bg-secondary px-1 font-mono">esc</kbd> to cancel
        </span>
      </div>
    </div>
  );
}
