import type { TaskStatus } from '@/api/types';

export const TASK_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  IN_REVIEW: 'In review',
  DONE: 'Done',
};

export const STATUS_ACCENT: Record<TaskStatus, string> = {
  TODO: 'bg-zinc-400 dark:bg-zinc-500',
  IN_PROGRESS: 'bg-blue-500',
  IN_REVIEW: 'bg-amber-500',
  DONE: 'bg-emerald-500',
};

export const STATUS_DOT: Record<TaskStatus, string> = {
  TODO: 'bg-zinc-400',
  IN_PROGRESS: 'bg-blue-500',
  IN_REVIEW: 'bg-amber-500',
  DONE: 'bg-emerald-500',
};
