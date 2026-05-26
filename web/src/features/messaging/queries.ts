import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  messagingApi,
  type CreateChannelPayload,
  type CreateMessagePayload,
  type UpdateChannelPayload,
  type UpdateMessagePayload,
} from '@/api/messaging';
import { getSocket } from '@/realtime/socket-client';
import type { MessagePage } from '@/api/types';

export const messagingKeys = {
  all: ['messaging'] as const,
  channels: (teamId: string) => [...messagingKeys.all, 'channels', teamId] as const,
  channel: (teamId: string, channelId: string) =>
    [...messagingKeys.all, 'channel', teamId, channelId] as const,
  messages: (teamId: string, channelId: string) =>
    [...messagingKeys.all, 'messages', teamId, channelId] as const,
};

export function useChannelsQuery(teamId: string) {
  return useQuery({
    queryKey: messagingKeys.channels(teamId),
    queryFn: () => messagingApi.listChannels(teamId),
    enabled: !!teamId,
  });
}

export function useChannelQuery(teamId: string, channelId: string | null) {
  return useQuery({
    queryKey: channelId ? messagingKeys.channel(teamId, channelId) : ['noop'],
    queryFn: () => messagingApi.getChannel(teamId, channelId as string),
    enabled: !!teamId && !!channelId,
  });
}

export function useMessagesQuery(teamId: string, channelId: string | null) {
  return useInfiniteQuery({
    queryKey: channelId ? messagingKeys.messages(teamId, channelId) : ['noop-messages'],
    queryFn: ({ pageParam }) =>
      messagingApi.listMessages(teamId, channelId as string, {
        cursor: pageParam as string | undefined,
        limit: 50,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: MessagePage) => lastPage.nextCursor ?? undefined,
    enabled: !!teamId && !!channelId,
  });
}

export function useCreateChannel(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateChannelPayload) => messagingApi.createChannel(teamId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: messagingKeys.channels(teamId) });
      // Ask the realtime server to re-fetch our channel memberships so the
      // new channel's Socket.IO room is joined without a reconnect.
      getSocket()?.emit('channels:refresh');
    },
  });
}

export function useUpdateChannel(teamId: string, channelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateChannelPayload) =>
      messagingApi.updateChannel(teamId, channelId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: messagingKeys.channels(teamId) });
      qc.invalidateQueries({ queryKey: messagingKeys.channel(teamId, channelId) });
    },
  });
}

export function useArchiveChannel(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (channelId: string) => messagingApi.archiveChannel(teamId, channelId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: messagingKeys.channels(teamId) });
    },
  });
}

export function useSendMessage(teamId: string, channelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateMessagePayload) =>
      messagingApi.createMessage(teamId, channelId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: messagingKeys.messages(teamId, channelId) });
    },
  });
}

export function useEditMessage(teamId: string, channelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, payload }: { messageId: string; payload: UpdateMessagePayload }) =>
      messagingApi.updateMessage(teamId, channelId, messageId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: messagingKeys.messages(teamId, channelId) });
    },
  });
}

export function useDeleteMessage(teamId: string, channelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) =>
      messagingApi.deleteMessage(teamId, channelId, messageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: messagingKeys.messages(teamId, channelId) });
    },
  });
}
