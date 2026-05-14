import { useEffect, useMemo, useState } from 'react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { CalendarDays, Trash2, UserCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import type { Task, TaskComment, TaskPriority, TaskStatus, TeamMemberPublic } from '@/api/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/store/auth';
import { cn, getInitials } from '@/lib/utils';
import { PriorityPill } from './priority-pill';
import {
  useAddComment,
  useDeleteComment,
  useDeleteTask,
  useTaskCommentsQuery,
  useTaskQuery,
  useUpdateTask,
} from './queries';
import { STATUS_LABEL, TASK_STATUSES } from './status';

const PRIORITIES: TaskPriority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];

interface TaskDetailSheetProps {
  teamId: string;
  taskId: string | null;
  members: TeamMemberPublic[];
  onClose: () => void;
}

export function TaskDetailSheet({ teamId, taskId, members, onClose }: TaskDetailSheetProps) {
  const open = !!taskId;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        {taskId && <Inner teamId={teamId} taskId={taskId} members={members} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function Inner({
  teamId,
  taskId,
  members,
  onClose,
}: {
  teamId: string;
  taskId: string;
  members: TeamMemberPublic[];
  onClose: () => void;
}) {
  const { data: task, isLoading } = useTaskQuery(teamId, taskId);
  const updateTask = useUpdateTask(teamId);
  const deleteTask = useDeleteTask(teamId);

  if (isLoading || !task) {
    return (
      <>
        <SheetHeader>
          <Skeleton className="h-6 w-1/2" />
          <SheetDescription>
            <Skeleton className="h-4 w-2/3" />
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          <Skeleton className="h-24 w-full" />
        </SheetBody>
      </>
    );
  }

  const memberLookup = new Map(members.map((m) => [m.userId, m]));

  const onUpdate = (payload: Parameters<typeof updateTask.mutate>[0]['payload']) => {
    updateTask.mutate(
      { taskId, payload },
      {
        onError: (err) => {
          const msg = err instanceof ApiError ? err.problem.detail ?? err.problem.title : 'Failed';
          toast.error(msg);
        },
      },
    );
  };

  const onDelete = () => {
    if (!confirm('Delete this task?')) return;
    deleteTask.mutate(taskId, {
      onSuccess: () => {
        toast.success('Task deleted');
        onClose();
      },
      onError: (err) => {
        const msg = err instanceof ApiError ? err.problem.detail ?? err.problem.title : 'Failed';
        toast.error(msg);
      },
    });
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle asChild>
          <EditableTitle initial={task.title} onSave={(title) => onUpdate({ title })} />
        </SheetTitle>
        <SheetDescription>Created {format(parseISO(task.createdAt), 'MMM d, yyyy')}</SheetDescription>
      </SheetHeader>

      <SheetBody className="space-y-6">
        <PropertiesGrid task={task} members={members} onUpdate={onUpdate} />

        <Section title="Description">
          <EditableDescription
            initial={task.description ?? ''}
            onSave={(description) => onUpdate({ description: description || null })}
          />
        </Section>

        <Section title="Comments">
          <Comments teamId={teamId} taskId={taskId} memberLookup={memberLookup} />
        </Section>
      </SheetBody>

      <SheetFooter className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" className="text-destructive" onClick={onDelete}>
          <Trash2 className="size-4" />
          Delete task
        </Button>
      </SheetFooter>
    </>
  );
}

function PropertiesGrid({
  task,
  members,
  onUpdate,
}: {
  task: Task;
  members: TeamMemberPublic[];
  onUpdate: (payload: Parameters<ReturnType<typeof useUpdateTask>['mutate']>[0]['payload']) => void;
}) {
  return (
    <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-2 text-sm">
      <dt className="self-center text-muted-foreground">Status</dt>
      <dd>
        <SelectPill<TaskStatus>
          value={task.status}
          options={TASK_STATUSES}
          render={(v) => STATUS_LABEL[v]}
          onChange={(status) => onUpdate({ status })}
        />
      </dd>

      <dt className="self-center text-muted-foreground">Priority</dt>
      <dd>
        <SelectPill<TaskPriority>
          value={task.priority}
          options={PRIORITIES}
          render={(v) => (
            <span className="inline-flex items-center gap-1.5">
              <PriorityPill priority={v} />
              {v[0]}{v.slice(1).toLowerCase()}
            </span>
          )}
          onChange={(priority) => onUpdate({ priority })}
        />
      </dd>

      <dt className="self-center text-muted-foreground">Assignee</dt>
      <dd>
        <AssigneeSelect
          value={task.assigneeUserId}
          members={members}
          onChange={(assigneeUserId) => onUpdate({ assigneeUserId })}
        />
      </dd>

      <dt className="self-center text-muted-foreground">Due</dt>
      <dd>
        <DueDateField
          value={task.dueDate}
          onChange={(dueDate) => onUpdate({ dueDate })}
        />
      </dd>
    </dl>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function EditableTitle({ initial, onSave }: { initial: string; onSave: (next: string) => void }) {
  const [value, setValue] = useState(initial);
  useEffect(() => setValue(initial), [initial]);
  return (
    <Input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const trimmed = value.trim();
        if (trimmed && trimmed !== initial) onSave(trimmed);
        else setValue(initial);
      }}
      className="border-0 bg-transparent px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
    />
  );
}

function EditableDescription({
  initial,
  onSave,
}: {
  initial: string;
  onSave: (next: string) => void;
}) {
  const [value, setValue] = useState(initial);
  useEffect(() => setValue(initial), [initial]);
  return (
    <Textarea
      rows={4}
      placeholder="Add more detail…"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (value !== initial) onSave(value);
      }}
    />
  );
}

function SelectPill<T extends string>({
  value,
  options,
  render,
  onChange,
}: {
  value: T;
  options: T[];
  render: (v: T) => React.ReactNode;
  onChange: (next: T) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full appearance-none rounded-md border bg-background px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {typeof render(option) === 'string' ? (render(option) as string) : option}
        </option>
      ))}
    </select>
  );
}

function AssigneeSelect({
  value,
  members,
  onChange,
}: {
  value: string | null;
  members: TeamMemberPublic[];
  onChange: (userId: string | null) => void;
}) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full appearance-none rounded-md border bg-background px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <option value="">Unassigned</option>
      {members.map((m) => (
        <option key={m.userId} value={m.userId}>
          {m.firstName} {m.lastName}
        </option>
      ))}
    </select>
  );
}

function DueDateField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const formatted = value ? format(parseISO(value), 'yyyy-MM-dd') : '';
  return (
    <div className="flex items-center gap-1">
      <CalendarDays className="size-4 text-muted-foreground" />
      <Input
        type="date"
        value={formatted}
        onChange={(e) => onChange(e.target.value || null)}
        className="border-0 bg-transparent px-1 py-1 shadow-none focus-visible:ring-0"
      />
    </div>
  );
}

function Comments({
  teamId,
  taskId,
  memberLookup,
}: {
  teamId: string;
  taskId: string;
  memberLookup: Map<string, TeamMemberPublic>;
}) {
  const { data: comments, isLoading } = useTaskCommentsQuery(teamId, taskId);
  const addComment = useAddComment(teamId, taskId);
  const deleteComment = useDeleteComment(teamId, taskId);
  const me = useAuthStore((s) => s.user);
  const [draft, setDraft] = useState('');

  const sorted = useMemo(
    () => (comments ? [...comments].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : []),
    [comments],
  );

  const submit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    addComment.mutate(trimmed, {
      onSuccess: () => setDraft(''),
      onError: (err) => {
        const msg = err instanceof ApiError ? err.problem.detail ?? err.problem.title : 'Failed';
        toast.error(msg);
      },
    });
  };

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {isLoading && <Skeleton className="h-12 w-full" />}
        {!isLoading && sorted.length === 0 && (
          <li className="text-sm text-muted-foreground">No comments yet.</li>
        )}
        {sorted.map((c) => (
          <CommentRow
            key={c.id}
            comment={c}
            memberLookup={memberLookup}
            canDelete={c.authorUserId === me?.id}
            onDelete={() => deleteComment.mutate(c.id)}
          />
        ))}
      </ul>

      <div className="rounded-lg border bg-card p-2">
        <Textarea
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Add a comment…"
          className="min-h-0 resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
        />
        <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>
            <kbd className="rounded bg-secondary px-1 font-mono">⌘↵</kbd> to send
          </span>
          <Button size="sm" onClick={submit} disabled={!draft.trim() || addComment.isPending}>
            Comment
          </Button>
        </div>
      </div>
    </div>
  );
}

function CommentRow({
  comment,
  memberLookup,
  canDelete,
  onDelete,
}: {
  comment: TaskComment;
  memberLookup: Map<string, TeamMemberPublic>;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const author = comment.authorUserId ? memberLookup.get(comment.authorUserId) : null;
  return (
    <li className="flex gap-2.5">
      {author ? (
        <Avatar className="size-7">
          {author.avatarUrl && <AvatarImage src={author.avatarUrl} alt="" />}
          <AvatarFallback className="text-[10px]">
            {getInitials(author.firstName, author.lastName)}
          </AvatarFallback>
        </Avatar>
      ) : (
        <UserCircle2 className="size-7 text-muted-foreground" />
      )}
      <div className="flex-1 space-y-1">
        <div className="flex items-baseline gap-2 text-xs">
          <span className="font-semibold">
            {author ? `${author.firstName} ${author.lastName}` : 'Former member'}
          </span>
          <span className="text-muted-foreground">
            {formatDistanceToNow(parseISO(comment.createdAt), { addSuffix: true })}
            {comment.editedAt && ' (edited)'}
          </span>
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              className={cn(
                'ml-auto text-muted-foreground transition-colors hover:text-destructive',
                'focus-visible:outline-none focus-visible:underline',
              )}
            >
              Delete
            </button>
          )}
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{comment.content}</p>
      </div>
    </li>
  );
}
