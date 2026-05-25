import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TaskPriority, TaskStatus } from '../../../generated/prisma/client';
import { TasksService } from './tasks.service';

type MockPrisma = {
  task: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
  taskComment: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  taskStatusHistory: {
    create: jest.Mock;
  };
  teamMember: {
    findUnique: jest.Mock;
  };
  $transaction: jest.Mock;
};

function makeMockPrisma(): MockPrisma {
  return {
    task: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    taskComment: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    taskStatusHistory: {
      create: jest.fn(),
    },
    teamMember: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

const TEAM_ID = '11111111-1111-1111-1111-111111111111';
const TASK_ID = '22222222-2222-2222-2222-222222222222';
const COMMENT_ID = '33333333-3333-3333-3333-333333333333';
const ALICE = '44444444-4444-4444-4444-444444444444';
const BOB = '55555555-5555-5555-5555-555555555555';

const baseTask = {
  id: TASK_ID,
  teamId: TEAM_ID,
  title: 'Test task',
  description: null,
  priority: TaskPriority.MEDIUM,
  status: TaskStatus.TODO,
  assigneeUserId: null,
  reporterUserId: ALICE,
  dueDate: null,
  labels: [],
  parentTaskId: null,
  position: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('TasksService', () => {
  let prisma: MockPrisma;
  let service: TasksService;

  beforeEach(() => {
    prisma = makeMockPrisma();
    service = new TasksService(prisma as never);
  });

  describe('create', () => {
    it('creates a task with reporter set to the creator and records the initial status transition', async () => {
      prisma.task.findFirst.mockResolvedValue({ position: 4 });
      prisma.task.create.mockResolvedValue({ ...baseTask, position: 5 });
      // The interactive transaction passes a tx client; here we hand back the same mock.
      prisma.$transaction.mockImplementation(async (cb: (tx: MockPrisma) => unknown) => cb(prisma));

      await service.create(TEAM_ID, ALICE, { title: 'New task' });

      expect(prisma.task.findFirst).toHaveBeenCalledWith({
        where: { teamId: TEAM_ID, status: TaskStatus.TODO },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      expect(prisma.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          teamId: TEAM_ID,
          title: 'New task',
          reporterUserId: ALICE,
          status: TaskStatus.TODO,
          priority: TaskPriority.MEDIUM,
          position: 5,
        }),
      });
      expect(prisma.taskStatusHistory.create).toHaveBeenCalledWith({
        data: {
          taskId: TASK_ID,
          teamId: TEAM_ID,
          fromStatus: null,
          toStatus: TaskStatus.TODO,
          changedByUserId: ALICE,
        },
      });
    });

    it('rejects an assignee who is not a member of the team', async () => {
      prisma.teamMember.findUnique.mockResolvedValue(null);

      await expect(
        service.create(TEAM_ID, ALICE, { title: 'x', assigneeUserId: BOB }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.task.create).not.toHaveBeenCalled();
    });

    it('rejects a parent task that belongs to a different team', async () => {
      prisma.task.findUnique.mockResolvedValue({ ...baseTask, teamId: 'other' });

      await expect(
        service.create(TEAM_ID, ALICE, { title: 'x', parentTaskId: 'parent-id' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('list', () => {
    it('applies filters and orders by (status, position)', async () => {
      prisma.task.findMany.mockResolvedValue([baseTask]);

      await service.list(TEAM_ID, {
        status: [TaskStatus.TODO, TaskStatus.IN_PROGRESS],
        priority: [TaskPriority.HIGH],
        assigneeUserId: ALICE,
        labels: ['backend'],
        topLevelOnly: true,
        query: 'auth',
        limit: 50,
      });

      expect(prisma.task.findMany).toHaveBeenCalledWith({
        where: {
          teamId: TEAM_ID,
          status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] },
          priority: { in: [TaskPriority.HIGH] },
          assigneeUserId: ALICE,
          labels: { hasSome: ['backend'] },
          parentTaskId: null,
          OR: [
            { title: { contains: 'auth', mode: 'insensitive' } },
            { description: { contains: 'auth', mode: 'insensitive' } },
          ],
        },
        orderBy: [{ status: 'asc' }, { position: 'asc' }],
        take: 50,
      });
    });
  });

  describe('getById', () => {
    it('throws NotFoundException when task is in a different team', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(service.getById(TEAM_ID, TASK_ID)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns the task when found in the team', async () => {
      prisma.task.findFirst.mockResolvedValue(baseTask);

      const result = await service.getById(TEAM_ID, TASK_ID);

      expect(result).toEqual(baseTask);
    });
  });

  describe('update (no move)', () => {
    it('updates non-positional fields via plain task.update and does not record history', async () => {
      prisma.task.findFirst.mockResolvedValue(baseTask);
      prisma.task.update.mockResolvedValue({ ...baseTask, title: 'New title' });

      await service.update(TEAM_ID, TASK_ID, ALICE, {
        title: 'New title',
        priority: TaskPriority.HIGH,
      });

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.taskStatusHistory.create).not.toHaveBeenCalled();
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: TASK_ID },
        data: expect.objectContaining({ title: 'New title', priority: TaskPriority.HIGH }),
      });
    });
  });

  describe('update (move)', () => {
    it('compacts the source column, records the transition, and inserts at the target position on cross-column move', async () => {
      prisma.task.findFirst.mockResolvedValue({ ...baseTask, status: TaskStatus.TODO, position: 2 });
      prisma.task.count.mockResolvedValue(3);
      // 4 ops on cross-column move: compactSource, historyInsert, makeRoomInDestination, moveTask
      prisma.$transaction.mockResolvedValue([{}, {}, {}, { ...baseTask, status: TaskStatus.IN_PROGRESS, position: 1 }]);

      await service.update(TEAM_ID, TASK_ID, ALICE, { status: TaskStatus.IN_PROGRESS, position: 1 });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const ops = prisma.$transaction.mock.calls[0][0];
      expect(ops).toHaveLength(4);
      expect(prisma.taskStatusHistory.create).toHaveBeenCalledWith({
        data: {
          taskId: TASK_ID,
          teamId: TEAM_ID,
          fromStatus: TaskStatus.TODO,
          toStatus: TaskStatus.IN_PROGRESS,
          changedByUserId: ALICE,
        },
      });
    });

    it('does not record history when only position changes within the same column', async () => {
      prisma.task.findFirst.mockResolvedValue({ ...baseTask, status: TaskStatus.TODO, position: 0 });
      prisma.task.count.mockResolvedValue(2);
      // 2 ops on same-column move: makeRoomInDestination, moveTask
      prisma.$transaction.mockResolvedValue([{}, { ...baseTask, position: 1 }]);

      await service.update(TEAM_ID, TASK_ID, ALICE, { position: 1 });

      expect(prisma.taskStatusHistory.create).not.toHaveBeenCalled();
      const ops = prisma.$transaction.mock.calls[0][0];
      expect(ops).toHaveLength(2);
    });

    it('caps requested position at the column size when moving across columns', async () => {
      prisma.task.findFirst.mockResolvedValue({ ...baseTask, status: TaskStatus.TODO, position: 0 });
      // Destination column has 2 other tasks
      prisma.task.count.mockResolvedValue(2);
      prisma.$transaction.mockResolvedValue([{}, {}, {}, { ...baseTask, status: TaskStatus.DONE, position: 2 }]);

      await service.update(TEAM_ID, TASK_ID, ALICE, { status: TaskStatus.DONE, position: 999 });

      expect(prisma.task.count).toHaveBeenCalledWith({
        where: { teamId: TEAM_ID, status: TaskStatus.DONE, id: { not: TASK_ID } },
      });
    });

    it('appends to destination when position is unspecified', async () => {
      prisma.task.findFirst.mockResolvedValue({ ...baseTask, status: TaskStatus.TODO, position: 0 });
      prisma.task.count.mockResolvedValue(2);
      prisma.$transaction.mockResolvedValue([{}, {}, {}, { ...baseTask, status: TaskStatus.DONE, position: 2 }]);

      await service.update(TEAM_ID, TASK_ID, ALICE, { status: TaskStatus.DONE });

      // We only check count was called (resolving the append target)
      expect(prisma.task.count).toHaveBeenCalled();
    });

    it('rejects assigning to a non-member during update', async () => {
      prisma.task.findFirst.mockResolvedValue(baseTask);
      prisma.teamMember.findUnique.mockResolvedValue(null);

      await expect(
        service.update(TEAM_ID, TASK_ID, ALICE, { assigneeUserId: BOB }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('delete', () => {
    it('removes the task and compacts the column behind it', async () => {
      prisma.task.findFirst.mockResolvedValue({ ...baseTask, position: 1 });
      prisma.$transaction.mockResolvedValue([{}, {}]);

      await service.delete(TEAM_ID, TASK_ID);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const ops = prisma.$transaction.mock.calls[0][0];
      expect(ops).toHaveLength(2);
    });
  });

  describe('comments', () => {
    const baseComment = {
      id: COMMENT_ID,
      taskId: TASK_ID,
      teamId: TEAM_ID,
      authorUserId: ALICE,
      content: 'hello',
      createdAt: new Date(),
      editedAt: null,
    };

    it('addComment denormalizes teamId from the parent task', async () => {
      prisma.task.findFirst.mockResolvedValue(baseTask);
      prisma.taskComment.create.mockResolvedValue(baseComment);

      await service.addComment(TEAM_ID, TASK_ID, ALICE, { content: 'hello' });

      expect(prisma.taskComment.create).toHaveBeenCalledWith({
        data: {
          taskId: TASK_ID,
          teamId: TEAM_ID,
          authorUserId: ALICE,
          content: 'hello',
        },
      });
    });

    it('updateComment rejects non-authors with ForbiddenException', async () => {
      prisma.taskComment.findFirst.mockResolvedValue({ ...baseComment, authorUserId: BOB });

      await expect(
        service.updateComment(TEAM_ID, COMMENT_ID, ALICE, { content: 'edit' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('updateComment sets editedAt to a fresh Date for the author', async () => {
      prisma.taskComment.findFirst.mockResolvedValue(baseComment);
      prisma.taskComment.update.mockResolvedValue({
        ...baseComment,
        content: 'edit',
        editedAt: new Date(),
      });

      await service.updateComment(TEAM_ID, COMMENT_ID, ALICE, { content: 'edit' });

      expect(prisma.taskComment.update).toHaveBeenCalledWith({
        where: { id: COMMENT_ID },
        data: { content: 'edit', editedAt: expect.any(Date) },
      });
    });

    it('deleteComment allows the author', async () => {
      prisma.taskComment.findFirst.mockResolvedValue(baseComment);

      await service.deleteComment(TEAM_ID, COMMENT_ID, ALICE, false);

      expect(prisma.taskComment.delete).toHaveBeenCalledWith({ where: { id: COMMENT_ID } });
    });

    it('deleteComment allows an admin even if not the author', async () => {
      prisma.taskComment.findFirst.mockResolvedValue({ ...baseComment, authorUserId: BOB });

      await service.deleteComment(TEAM_ID, COMMENT_ID, ALICE, true);

      expect(prisma.taskComment.delete).toHaveBeenCalled();
    });

    it('deleteComment rejects a non-author non-admin', async () => {
      prisma.taskComment.findFirst.mockResolvedValue({ ...baseComment, authorUserId: BOB });

      await expect(
        service.deleteComment(TEAM_ID, COMMENT_ID, ALICE, false),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.taskComment.delete).not.toHaveBeenCalled();
    });
  });
});
