import { QueryClient } from '@tanstack/react-query';
import type { Message, MessagePage } from '@/api/types';
import { messagingKeys } from '@/features/messaging/queries';

interface InfiniteQueryShape {
  pages: MessagePage[];
  pageParams: unknown[];
}

/**
 * Pure functions that mutate the messages-infinite-query cache for a given
 * (teamId, channelId). Idempotent on message id — if the same event arrives
 * twice (e.g. local optimistic update + server echo), the cache stays consistent.
 */

export function applyMessageCreated(
  qc: QueryClient,
  teamId: string,
  channelId: string,
  message: Message,
): void {
  qc.setQueryData<InfiniteQueryShape>(
    messagingKeys.messages(teamId, channelId),
    (prev) => {
      if (!prev) return prev;
      if (containsMessage(prev, message.id)) return prev;
      const [firstPage, ...rest] = prev.pages;
      if (!firstPage) return prev;
      // The first page is "most recent" — server returns DESC by createdAt.
      // Prepending the new message keeps the chronological ordering correct.
      return {
        ...prev,
        pages: [{ ...firstPage, items: [message, ...firstPage.items] }, ...rest],
      };
    },
  );
}

export function applyMessageEdited(
  qc: QueryClient,
  teamId: string,
  channelId: string,
  message: Message,
): void {
  qc.setQueryData<InfiniteQueryShape>(
    messagingKeys.messages(teamId, channelId),
    (prev) => {
      if (!prev) return prev;
      let mutated = false;
      const pages = prev.pages.map((page) => ({
        ...page,
        items: page.items.map((m) => {
          if (m.id !== message.id) return m;
          mutated = true;
          return message;
        }),
      }));
      return mutated ? { ...prev, pages } : prev;
    },
  );
}

export function applyMessageDeleted(
  qc: QueryClient,
  teamId: string,
  channelId: string,
  messageId: string,
): void {
  qc.setQueryData<InfiniteQueryShape>(
    messagingKeys.messages(teamId, channelId),
    (prev) => {
      if (!prev) return prev;
      let removed = false;
      const pages = prev.pages.map((page) => {
        const filtered = page.items.filter((m) => {
          if (m.id === messageId) {
            removed = true;
            return false;
          }
          return true;
        });
        return { ...page, items: filtered };
      });
      return removed ? { ...prev, pages } : prev;
    },
  );
}

function containsMessage(query: InfiniteQueryShape, id: string): boolean {
  return query.pages.some((page) => page.items.some((m) => m.id === id));
}
