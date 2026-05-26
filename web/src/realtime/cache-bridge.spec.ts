import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Message } from '@/api/types';
import { messagingKeys } from '@/features/messaging/queries';
import {
  applyMessageCreated,
  applyMessageDeleted,
  applyMessageEdited,
} from './cache-bridge';

const TEAM_ID = 'team-1';
const CHANNEL_ID = 'channel-1';

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm-1',
    channelId: CHANNEL_ID,
    teamId: TEAM_ID,
    authorUserId: 'user-A',
    content: 'hello',
    createdAt: '2026-05-23T12:00:00.000Z',
    editedAt: null,
    deletedAt: null,
    attachments: [],
    ...overrides,
  };
}

function seedInfiniteQuery(qc: QueryClient, items: Message[]) {
  qc.setQueryData(messagingKeys.messages(TEAM_ID, CHANNEL_ID), {
    pages: [{ items, nextCursor: null }],
    pageParams: [undefined],
  });
}

function getItems(qc: QueryClient): Message[] {
  const data = qc.getQueryData<{ pages: { items: Message[] }[] }>(
    messagingKeys.messages(TEAM_ID, CHANNEL_ID),
  );
  return data?.pages.flatMap((p) => p.items) ?? [];
}

describe('cache-bridge', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient();
  });

  describe('applyMessageCreated', () => {
    it('prepends the new message to the first page', () => {
      seedInfiniteQuery(qc, [makeMessage({ id: 'm-1' }), makeMessage({ id: 'm-2' })]);

      applyMessageCreated(qc, TEAM_ID, CHANNEL_ID, makeMessage({ id: 'm-NEW' }));

      const items = getItems(qc);
      expect(items.map((m) => m.id)).toEqual(['m-NEW', 'm-1', 'm-2']);
    });

    it('is idempotent — duplicate id is not inserted twice', () => {
      seedInfiniteQuery(qc, [makeMessage({ id: 'm-1' })]);

      applyMessageCreated(qc, TEAM_ID, CHANNEL_ID, makeMessage({ id: 'm-1' }));

      expect(getItems(qc).map((m) => m.id)).toEqual(['m-1']);
    });

    it('checks for duplicate across ALL pages, not just the first', () => {
      qc.setQueryData(messagingKeys.messages(TEAM_ID, CHANNEL_ID), {
        pages: [
          { items: [makeMessage({ id: 'm-NEW' })], nextCursor: 'c1' },
          { items: [makeMessage({ id: 'm-OLD' })], nextCursor: null },
        ],
        pageParams: [undefined, 'c1'],
      });

      applyMessageCreated(qc, TEAM_ID, CHANNEL_ID, makeMessage({ id: 'm-OLD' }));

      // m-OLD already exists on page 2 — must not re-insert at the top.
      expect(getItems(qc).map((m) => m.id)).toEqual(['m-NEW', 'm-OLD']);
    });

    it('is a no-op when the query has not been opened yet', () => {
      applyMessageCreated(qc, TEAM_ID, CHANNEL_ID, makeMessage({ id: 'm-1' }));
      expect(qc.getQueryData(messagingKeys.messages(TEAM_ID, CHANNEL_ID))).toBeUndefined();
    });
  });

  describe('applyMessageEdited', () => {
    it('replaces the matching message by id', () => {
      seedInfiniteQuery(qc, [
        makeMessage({ id: 'm-1', content: 'old' }),
        makeMessage({ id: 'm-2', content: 'other' }),
      ]);

      applyMessageEdited(
        qc,
        TEAM_ID,
        CHANNEL_ID,
        makeMessage({ id: 'm-1', content: 'new', editedAt: '2026-05-23T12:01:00.000Z' }),
      );

      const items = getItems(qc);
      expect(items.find((m) => m.id === 'm-1')?.content).toBe('new');
      expect(items.find((m) => m.id === 'm-1')?.editedAt).toBe('2026-05-23T12:01:00.000Z');
      expect(items.find((m) => m.id === 'm-2')?.content).toBe('other');
    });

    it('is a no-op when the id is not in the cache', () => {
      seedInfiniteQuery(qc, [makeMessage({ id: 'm-1' })]);
      const before = qc.getQueryData(messagingKeys.messages(TEAM_ID, CHANNEL_ID));

      applyMessageEdited(qc, TEAM_ID, CHANNEL_ID, makeMessage({ id: 'm-not-here', content: 'x' }));

      const after = qc.getQueryData(messagingKeys.messages(TEAM_ID, CHANNEL_ID));
      expect(after).toBe(before); // unchanged reference — no re-render triggered
    });

    it('finds and edits messages on later pages', () => {
      qc.setQueryData(messagingKeys.messages(TEAM_ID, CHANNEL_ID), {
        pages: [
          { items: [makeMessage({ id: 'm-1' })], nextCursor: 'c1' },
          { items: [makeMessage({ id: 'm-2', content: 'old' })], nextCursor: null },
        ],
        pageParams: [undefined, 'c1'],
      });

      applyMessageEdited(qc, TEAM_ID, CHANNEL_ID, makeMessage({ id: 'm-2', content: 'new' }));

      expect(getItems(qc).find((m) => m.id === 'm-2')?.content).toBe('new');
    });
  });

  describe('applyMessageDeleted', () => {
    it('removes the message by id', () => {
      seedInfiniteQuery(qc, [
        makeMessage({ id: 'm-1' }),
        makeMessage({ id: 'm-2' }),
        makeMessage({ id: 'm-3' }),
      ]);

      applyMessageDeleted(qc, TEAM_ID, CHANNEL_ID, 'm-2');

      expect(getItems(qc).map((m) => m.id)).toEqual(['m-1', 'm-3']);
    });

    it('is a no-op when the id is not in the cache', () => {
      seedInfiniteQuery(qc, [makeMessage({ id: 'm-1' })]);
      const before = qc.getQueryData(messagingKeys.messages(TEAM_ID, CHANNEL_ID));

      applyMessageDeleted(qc, TEAM_ID, CHANNEL_ID, 'm-not-here');

      expect(qc.getQueryData(messagingKeys.messages(TEAM_ID, CHANNEL_ID))).toBe(before);
    });

    it('finds and removes messages on later pages', () => {
      qc.setQueryData(messagingKeys.messages(TEAM_ID, CHANNEL_ID), {
        pages: [
          { items: [makeMessage({ id: 'm-1' })], nextCursor: 'c1' },
          { items: [makeMessage({ id: 'm-2' })], nextCursor: null },
        ],
        pageParams: [undefined, 'c1'],
      });

      applyMessageDeleted(qc, TEAM_ID, CHANNEL_ID, 'm-2');

      expect(getItems(qc).map((m) => m.id)).toEqual(['m-1']);
    });
  });
});
