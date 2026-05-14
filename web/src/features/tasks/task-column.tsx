import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Task, TaskStatus, TeamMemberPublic } from '@/api/types';
import { cn } from '@/lib/utils';
import { STATUS_ACCENT, STATUS_LABEL } from './status';
import { TaskCard } from './task-card';
import { TaskQuickAdd } from './task-quick-add';

interface TaskColumnProps {
  teamId: string;
  status: TaskStatus;
  tasks: Task[];
  memberLookup: Map<string, TeamMemberPublic>;
  onOpenTask: (taskId: string) => void;
}

export function TaskColumn({
  teamId,
  status,
  tasks,
  memberLookup,
  onOpenTask,
}: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${status}`,
    data: { type: 'column', status },
  });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-xl border bg-card/40 transition-colors',
        isOver && 'border-primary/40 bg-primary/5',
      )}
    >
      <header className="flex items-center justify-between gap-2 px-3 pt-3">
        <div className="flex items-center gap-2">
          <span
            className={cn('size-1.5 rounded-full', STATUS_ACCENT[status])}
            aria-hidden
          />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {STATUS_LABEL[status]}
          </h3>
          <span className="rounded-md bg-secondary px-1.5 text-[11px] font-medium text-secondary-foreground">
            {tasks.length}
          </span>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2 scrollbar-thin">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.length === 0 && (
            <div
              className={cn(
                'rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground transition-colors',
                isOver ? 'border-primary/40' : 'border-border',
              )}
            >
              Drop here or use + to add
            </div>
          )}
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              memberLookup={memberLookup}
              onOpen={onOpenTask}
            />
          ))}
        </SortableContext>
      </div>

      <div className="px-2 pb-2">
        <TaskQuickAdd teamId={teamId} status={status} />
      </div>
    </section>
  );
}
