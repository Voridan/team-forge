import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { differenceInCalendarDays, format, startOfDay } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { useMemo } from 'react';
import type { Task, TeamMemberPublic } from '@/api/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, getInitials } from '@/lib/utils';
import { PriorityPill } from './priority-pill';

const MAX_VISIBLE_LABELS = 2;
const DUE_RELATIVE_WINDOW_DAYS = 7;

interface TaskCardProps {
  task: Task;
  memberLookup: Map<string, TeamMemberPublic>;
  onOpen: (taskId: string) => void;
  isOverlay?: boolean;
}

export function TaskCard({ task, memberLookup, onOpen, isOverlay = false }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { task } });

  const assignee = task.assigneeUserId
    ? memberLookup.get(task.assigneeUserId)
    : undefined;

  const dueState = useMemo(() => {
    if (!task.dueDate) return null;
    const due = new Date(task.dueDate);
    const diffDays = differenceInCalendarDays(due, startOfDay(new Date()));
    return {
      label: formatDue(due, diffDays),
      overdue: diffDays < 0,
    };
  }, [task.dueDate]);

  const visibleLabels = task.labels.slice(0, MAX_VISIBLE_LABELS);
  const extraLabels = task.labels.length - visibleLabels.length;

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (isDragging) return;
        e.stopPropagation();
        onOpen(task.id);
      }}
      aria-label={task.title}
      className={cn(
        'group flex w-full cursor-grab flex-col gap-2 rounded-lg border bg-card p-3 text-left shadow-sm transition-all',
        'hover:border-foreground/20 hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isDragging && 'opacity-50',
        isOverlay && 'rotate-2 cursor-grabbing shadow-2xl ring-2 ring-primary/40',
      )}
    >
      {(visibleLabels.length > 0 || task.priority !== 'MEDIUM') && (
        <div className="flex flex-wrap items-center gap-1">
          {task.priority !== 'MEDIUM' && <PriorityPill priority={task.priority} />}
          {visibleLabels.map((label) => (
            <span
              key={label}
              className="inline-flex h-5 max-w-[8rem] items-center truncate rounded-md bg-secondary px-1.5 text-[10.5px] font-medium text-secondary-foreground"
            >
              {label}
            </span>
          ))}
          {extraLabels > 0 && (
            <span className="text-[10.5px] font-medium text-muted-foreground">
              +{extraLabels}
            </span>
          )}
        </div>
      )}

      <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
        {task.title}
      </p>

      <div className="flex items-center justify-between gap-2 pt-1">
        {dueState ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-[11px] font-medium',
              dueState.overdue ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
            )}
          >
            <CalendarDays className="size-3" />
            {dueState.label}
          </span>
        ) : (
          <span />
        )}

        {assignee ? (
          <Avatar className="size-6 ring-2 ring-background">
            {assignee.avatarUrl && <AvatarImage src={assignee.avatarUrl} alt="" />}
            <AvatarFallback className="text-[10px]">
              {getInitials(assignee.firstName, assignee.lastName)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <span className="size-6 rounded-full border border-dashed border-muted-foreground/40" />
        )}
      </div>
    </button>
  );
}

function formatDue(due: Date, diffDays: number): string {
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 1 && diffDays < DUE_RELATIVE_WINDOW_DAYS) return `In ${diffDays}d`;
  if (diffDays < -1 && diffDays > -DUE_RELATIVE_WINDOW_DAYS) {
    return `${Math.abs(diffDays)}d ago`;
  }
  return format(due, 'MMM d');
}
