import { apiFetch } from './client';
import type { Task, TaskComment, TaskPriority, TaskStatus } from './types';

export interface CreateTaskPayload {
  title: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  assigneeUserId?: string;
  dueDate?: string;
  labels?: string[];
  parentTaskId?: string;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  position?: number;
  assigneeUserId?: string | null;
  dueDate?: string | null;
  labels?: string[];
}

export interface ListTasksParams {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  assigneeUserId?: string;
  labels?: string[];
  query?: string;
  topLevelOnly?: boolean;
  limit?: number;
}

function buildQuery(params: ListTasksParams): string {
  const search = new URLSearchParams();
  if (params.status?.length) search.set('status', params.status.join(','));
  if (params.priority?.length) search.set('priority', params.priority.join(','));
  if (params.assigneeUserId) search.set('assigneeUserId', params.assigneeUserId);
  if (params.labels?.length) search.set('labels', params.labels.join(','));
  if (params.query) search.set('query', params.query);
  if (params.topLevelOnly !== undefined) search.set('topLevelOnly', String(params.topLevelOnly));
  if (params.limit !== undefined) search.set('limit', String(params.limit));
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const tasksApi = {
  list: (teamId: string, params: ListTasksParams = {}) =>
    apiFetch<Task[]>(`/teams/${teamId}/tasks${buildQuery(params)}`),

  get: (teamId: string, taskId: string) =>
    apiFetch<Task>(`/teams/${teamId}/tasks/${taskId}`),

  create: (teamId: string, payload: CreateTaskPayload) =>
    apiFetch<Task>(`/teams/${teamId}/tasks`, { method: 'POST', body: payload }),

  update: (teamId: string, taskId: string, payload: UpdateTaskPayload) =>
    apiFetch<Task>(`/teams/${teamId}/tasks/${taskId}`, { method: 'PATCH', body: payload }),

  delete: (teamId: string, taskId: string) =>
    apiFetch<void>(`/teams/${teamId}/tasks/${taskId}`, { method: 'DELETE' }),

  listComments: (teamId: string, taskId: string) =>
    apiFetch<TaskComment[]>(`/teams/${teamId}/tasks/${taskId}/comments`),

  addComment: (teamId: string, taskId: string, content: string) =>
    apiFetch<TaskComment>(`/teams/${teamId}/tasks/${taskId}/comments`, {
      method: 'POST',
      body: { content },
    }),

  updateComment: (teamId: string, taskId: string, commentId: string, content: string) =>
    apiFetch<TaskComment>(`/teams/${teamId}/tasks/${taskId}/comments/${commentId}`, {
      method: 'PATCH',
      body: { content },
    }),

  deleteComment: (teamId: string, taskId: string, commentId: string) =>
    apiFetch<void>(`/teams/${teamId}/tasks/${taskId}/comments/${commentId}`, {
      method: 'DELETE',
    }),
};
