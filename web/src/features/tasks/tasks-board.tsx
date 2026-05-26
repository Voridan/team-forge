import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import type { Task, TaskStatus, TeamMemberPublic } from '@/api/types';
import { Skeleton } from '@/components/ui/skeleton';
import { TaskCard } from './task-card';
import { TaskColumn } from './task-column';
import { taskKeys, useTasksQuery, useUpdateTask } from './queries';
import { TASK_STATUSES } from './status';
import { TaskDetailSheet } from './task-detail-sheet';

const POINTER_DRAG_DISTANCE_PX = 5;

interface TasksBoardProps {
  teamId: string;
  members: TeamMemberPublic[];
}

export function TasksBoard({ teamId, members }: TasksBoardProps) {
  const { data: tasks, isLoading } = useTasksQuery(teamId, { topLevelOnly: true });
  const updateTask = useUpdateTask(teamId);
  const qc = useQueryClient();

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: POINTER_DRAG_DISTANCE_PX },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const memberLookup = useMemo(
    () => new Map(members.map((m) => [m.userId, m])),
    [members],
  );

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      TODO: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      DONE: [],
    };
    if (!tasks) return grouped;
    for (const task of tasks) grouped[task.status].push(task);
    for (const status of TASK_STATUSES) {
      grouped[status].sort((a, b) => a.position - b.position);
    }
    return grouped;
  }, [tasks]);

  const activeTask = useMemo(
    () => tasks?.find((t) => t.id === activeTaskId) ?? null,
    [tasks, activeTaskId],
  );

  const onDragStart = (event: DragStartEvent) => {
    setActiveTaskId(String(event.active.id));
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveTaskId(null);

    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId || !tasks) return;

    const moving = tasks.find((t) => t.id === activeId);
    if (!moving) return;

    const { targetStatus, targetPosition } = resolveDropTarget(
      moving,
      overId,
      tasks,
    );

    const samePlace =
      moving.status === targetStatus && moving.position === targetPosition;
    if (samePlace) return;

    const snapshot = qc.getQueryData<Task[]>(
      taskKeys.list(teamId, { topLevelOnly: true }),
    );

    qc.setQueryData<Task[]>(
      taskKeys.list(teamId, { topLevelOnly: true }),
      (prev) => optimisticReorder(prev ?? [], moving, targetStatus, targetPosition),
    );

    updateTask.mutate(
      {
        taskId: activeId,
        payload: { status: targetStatus, position: targetPosition },
      },
      {
        onError: (err) => {
          // Roll back optimistic update.
          if (snapshot) {
            qc.setQueryData(taskKeys.list(teamId, { topLevelOnly: true }), snapshot);
          }
          const msg =
            err instanceof ApiError
              ? err.problem.detail ?? err.problem.title
              : 'Could not move task';
          toast.error(msg);
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {TASK_STATUSES.map((status) => (
          <div key={status} className="flex w-72 shrink-0 flex-col gap-2 rounded-xl border p-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveTaskId(null)}
      >
        <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-thin">
          {TASK_STATUSES.map((status) => (
            <TaskColumn
              key={status}
              teamId={teamId}
              status={status}
              tasks={tasksByStatus[status]}
              memberLookup={memberLookup}
              onOpenTask={setOpenTaskId}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 180 }}>
          {activeTask && (
            <TaskCard
              task={activeTask}
              memberLookup={memberLookup}
              onOpen={() => {}}
              isOverlay
            />
          )}
        </DragOverlay>
      </DndContext>

      <TaskDetailSheet
        teamId={teamId}
        taskId={openTaskId}
        members={members}
        onClose={() => setOpenTaskId(null)}
      />
    </>
  );
}

/**
 * Given the drop target id (either a card or a column placeholder), compute the
 * destination column and the position within it.
 */
function resolveDropTarget(
  moving: Task,
  overId: string,
  tasks: Task[],
): { targetStatus: TaskStatus; targetPosition: number } {
  if (overId.startsWith('column:')) {
    const targetStatus = overId.slice('column:'.length) as TaskStatus;
    const destColumn = tasks
      .filter((t) => t.status === targetStatus && t.id !== moving.id)
      .sort((a, b) => a.position - b.position);
    return { targetStatus, targetPosition: destColumn.length };
  }

  const over = tasks.find((t) => t.id === overId);
  if (!over) return { targetStatus: moving.status, targetPosition: moving.position };

  const destColumn = tasks
    .filter((t) => t.status === over.status && t.id !== moving.id)
    .sort((a, b) => a.position - b.position);
  const overIndex = destColumn.findIndex((t) => t.id === over.id);
  return {
    targetStatus: over.status,
    targetPosition: overIndex === -1 ? destColumn.length : overIndex,
  };
}

/**
 * Apply the move to the cached task list so the UI updates instantly.
 * Repositioning preserves the (status, position) contiguous-integer invariant.
 */
function optimisticReorder(
  prev: Task[],
  moving: Task,
  targetStatus: TaskStatus,
  targetPosition: number,
): Task[] {
  // Strip the moved task and compact the source column.
  const withoutMoving = prev
    .filter((t) => t.id !== moving.id)
    .map((t) =>
      t.status === moving.status && t.position > moving.position
        ? { ...t, position: t.position - 1 }
        : t,
    );

  // Make room in the destination column.
  const shifted = withoutMoving.map((t) =>
    t.status === targetStatus && t.position >= targetPosition
      ? { ...t, position: t.position + 1 }
      : t,
  );

  return [...shifted, { ...moving, status: targetStatus, position: targetPosition }];
}
