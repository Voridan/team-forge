import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  tasksApi,
  type CreateTaskPayload,
  type ListTasksParams,
  type UpdateTaskPayload,
} from '@/api/tasks';

export const taskKeys = {
  all: ['tasks'] as const,
  list: (teamId: string, params?: ListTasksParams) =>
    [...taskKeys.all, 'list', teamId, params ?? {}] as const,
  detail: (teamId: string, taskId: string) =>
    [...taskKeys.all, 'detail', teamId, taskId] as const,
  comments: (teamId: string, taskId: string) =>
    [...taskKeys.all, 'comments', teamId, taskId] as const,
};

export function useTasksQuery(teamId: string, params: ListTasksParams = {}) {
  return useQuery({
    queryKey: taskKeys.list(teamId, params),
    queryFn: () => tasksApi.list(teamId, params),
    enabled: !!teamId,
  });
}

export function useTaskQuery(teamId: string, taskId: string | null) {
  return useQuery({
    queryKey: taskId ? taskKeys.detail(teamId, taskId) : ['noop'],
    queryFn: () => tasksApi.get(teamId, taskId as string),
    enabled: !!teamId && !!taskId,
  });
}

export function useTaskCommentsQuery(teamId: string, taskId: string | null) {
  return useQuery({
    queryKey: taskId ? taskKeys.comments(teamId, taskId) : ['noop'],
    queryFn: () => tasksApi.listComments(teamId, taskId as string),
    enabled: !!teamId && !!taskId,
  });
}

export function useCreateTask(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTaskPayload) => tasksApi.create(teamId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...taskKeys.all, 'list', teamId] });
    },
  });
}

export function useUpdateTask(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, payload }: { taskId: string; payload: UpdateTaskPayload }) =>
      tasksApi.update(teamId, taskId, payload),
    onSuccess: (task) => {
      qc.invalidateQueries({ queryKey: [...taskKeys.all, 'list', teamId] });
      qc.setQueryData(taskKeys.detail(teamId, task.id), task);
    },
  });
}

export function useDeleteTask(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => tasksApi.delete(teamId, taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...taskKeys.all, 'list', teamId] });
    },
  });
}

export function useAddComment(teamId: string, taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => tasksApi.addComment(teamId, taskId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.comments(teamId, taskId) });
    },
  });
}

export function useDeleteComment(teamId: string, taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => tasksApi.deleteComment(teamId, taskId, commentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.comments(teamId, taskId) });
    },
  });
}
