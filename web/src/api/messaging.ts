import { apiFetch } from './client';
import type { Channel, Message, MessagePage } from './types';

export interface CreateChannelPayload {
  name: string;
  description?: string;
}

export interface UpdateChannelPayload {
  name?: string;
  description?: string;
}

export interface CreateMessagePayload {
  content: string;
  attachmentIds?: string[];
}

export interface UpdateMessagePayload {
  content: string;
}

export interface ListMessagesParams {
  cursor?: string;
  limit?: number;
}

function buildQuery(params: ListMessagesParams): string {
  const search = new URLSearchParams();
  if (params.cursor) search.set('cursor', params.cursor);
  if (params.limit !== undefined) search.set('limit', String(params.limit));
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const messagingApi = {
  // Channels
  listChannels: (teamId: string) =>
    apiFetch<Channel[]>(`/teams/${teamId}/channels`),

  getChannel: (teamId: string, channelId: string) =>
    apiFetch<Channel>(`/teams/${teamId}/channels/${channelId}`),

  createChannel: (teamId: string, payload: CreateChannelPayload) =>
    apiFetch<Channel>(`/teams/${teamId}/channels`, { method: 'POST', body: payload }),

  updateChannel: (teamId: string, channelId: string, payload: UpdateChannelPayload) =>
    apiFetch<Channel>(`/teams/${teamId}/channels/${channelId}`, {
      method: 'PATCH',
      body: payload,
    }),

  archiveChannel: (teamId: string, channelId: string) =>
    apiFetch<void>(`/teams/${teamId}/channels/${channelId}`, { method: 'DELETE' }),

  // Messages
  listMessages: (teamId: string, channelId: string, params: ListMessagesParams = {}) =>
    apiFetch<MessagePage>(
      `/teams/${teamId}/channels/${channelId}/messages${buildQuery(params)}`,
    ),

  createMessage: (teamId: string, channelId: string, payload: CreateMessagePayload) =>
    apiFetch<Message>(`/teams/${teamId}/channels/${channelId}/messages`, {
      method: 'POST',
      body: payload,
    }),

  updateMessage: (
    teamId: string,
    channelId: string,
    messageId: string,
    payload: UpdateMessagePayload,
  ) =>
    apiFetch<Message>(
      `/teams/${teamId}/channels/${channelId}/messages/${messageId}`,
      { method: 'PATCH', body: payload },
    ),

  deleteMessage: (teamId: string, channelId: string, messageId: string) =>
    apiFetch<void>(`/teams/${teamId}/channels/${channelId}/messages/${messageId}`, {
      method: 'DELETE',
    }),
};
