import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  Task,
  TaskComment,
  TaskPriority,
  TaskStatus,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksDto } from './dto/list-tasks.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(teamId: string, requesterId: string, dto: CreateTaskDto): Promise<Task> {
    if (dto.assigneeUserId) {
      await this.assertTeamMember(teamId, dto.assigneeUserId, 'assignee');
    }
    if (dto.parentTaskId) {
      await this.assertParentInTeam(teamId, dto.parentTaskId);
    }

    const status = dto.status ?? TaskStatus.TODO;
    const position = await this.nextPosition(teamId, status);

    return this.prisma.task.create({
      data: {
        teamId,
        title: dto.title,
        description: dto.description,
        priority: dto.priority ?? TaskPriority.MEDIUM,
        status,
        assigneeUserId: dto.assigneeUserId,
        reporterUserId: requesterId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        labels: dto.labels ?? [],
        parentTaskId: dto.parentTaskId,
        position,
      },
    });
  }

  async list(teamId: string, filters: ListTasksDto): Promise<Task[]> {
    const where: Prisma.TaskWhereInput = { teamId };
    if (filters.status?.length) where.status = { in: filters.status };
    if (filters.priority?.length) where.priority = { in: filters.priority };
    if (filters.assigneeUserId) where.assigneeUserId = filters.assigneeUserId;
    if (filters.labels?.length) where.labels = { hasSome: filters.labels };
    if (filters.dueBefore) where.dueDate = { ...(where.dueDate as object), lte: new Date(filters.dueBefore) };
    if (filters.dueAfter) where.dueDate = { ...(where.dueDate as object), gte: new Date(filters.dueAfter) };
    if (filters.topLevelOnly) where.parentTaskId = null;
    if (filters.query) {
      where.OR = [
        { title: { contains: filters.query, mode: 'insensitive' } },
        { description: { contains: filters.query, mode: 'insensitive' } },
      ];
    }

    return this.prisma.task.findMany({
      where,
      orderBy: [{ status: 'asc' }, { position: 'asc' }],
      take: filters.limit ?? 100,
    });
  }

  async getById(teamId: string, taskId: string): Promise<Task> {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, teamId } });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async update(teamId: string, taskId: string, dto: UpdateTaskDto): Promise<Task> {
    const existing = await this.getById(teamId, taskId);

    if (dto.assigneeUserId) {
      await this.assertTeamMember(teamId, dto.assigneeUserId, 'assignee');
    }

    const movingStatus = dto.status !== undefined && dto.status !== existing.status;
    const movingPosition = dto.position !== undefined && dto.position !== existing.position;

    if (movingStatus || movingPosition) {
      return this.moveTask(existing, dto.status ?? existing.status, dto.position, dto);
    }

    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        assigneeUserId: dto.assigneeUserId === undefined ? undefined : dto.assigneeUserId,
        dueDate: dto.dueDate === undefined ? undefined : dto.dueDate ? new Date(dto.dueDate) : null,
        labels: dto.labels,
      },
    });
  }

  async delete(teamId: string, taskId: string): Promise<void> {
    const existing = await this.getById(teamId, taskId);
    await this.prisma.$transaction([
      this.prisma.task.delete({ where: { id: taskId } }),
      this.prisma.task.updateMany({
        where: { teamId, status: existing.status, position: { gt: existing.position } },
        data: { position: { decrement: 1 } },
      }),
    ]);
  }

  // --- Comments ---

  async listComments(teamId: string, taskId: string): Promise<TaskComment[]> {
    await this.getById(teamId, taskId);
    return this.prisma.taskComment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addComment(
    teamId: string,
    taskId: string,
    authorUserId: string,
    dto: CreateCommentDto,
  ): Promise<TaskComment> {
    await this.getById(teamId, taskId);
    return this.prisma.taskComment.create({
      data: {
        taskId,
        teamId,
        authorUserId,
        content: dto.content,
      },
    });
  }

  async updateComment(
    teamId: string,
    commentId: string,
    requesterId: string,
    dto: UpdateCommentDto,
  ): Promise<TaskComment> {
    const comment = await this.prisma.taskComment.findFirst({
      where: { id: commentId, teamId },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorUserId !== requesterId) {
      throw new ForbiddenException('You can only edit your own comments');
    }
    return this.prisma.taskComment.update({
      where: { id: commentId },
      data: { content: dto.content, editedAt: new Date() },
    });
  }

  async deleteComment(
    teamId: string,
    commentId: string,
    requesterId: string,
    requesterIsAdminOrHigher: boolean,
  ): Promise<void> {
    const comment = await this.prisma.taskComment.findFirst({
      where: { id: commentId, teamId },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    const isAuthor = comment.authorUserId === requesterId;
    if (!isAuthor && !requesterIsAdminOrHigher) {
      throw new ForbiddenException('Only the author or an admin can delete a comment');
    }
    await this.prisma.taskComment.delete({ where: { id: commentId } });
  }

  // --- Internal helpers ---

  private async assertTeamMember(
    teamId: string,
    userId: string,
    role: 'assignee' | 'reporter',
  ): Promise<void> {
    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!member) {
      throw new BadRequestException(`Cannot set ${role}: user is not a member of this team`);
    }
  }

  private async assertParentInTeam(teamId: string, parentTaskId: string): Promise<void> {
    const parent = await this.prisma.task.findUnique({ where: { id: parentTaskId } });
    if (!parent || parent.teamId !== teamId) {
      throw new BadRequestException('Parent task does not exist in this team');
    }
  }

  private async nextPosition(teamId: string, status: TaskStatus): Promise<number> {
    const last = await this.prisma.task.findFirst({
      where: { teamId, status },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return last ? last.position + 1 : 0;
  }

  /**
   * Atomically move a task to a new (status, position). Handles renumbering of
   * other tasks in both the source and destination columns so positions remain
   * a contiguous 0..N sequence per (teamId, status).
   */
  private async moveTask(
    existing: Task,
    newStatus: TaskStatus,
    requestedPosition: number | undefined,
    dto: UpdateTaskDto,
  ): Promise<Task> {
    const { teamId, id, status: oldStatus, position: oldPosition } = existing;

    const ops: Prisma.PrismaPromise<unknown>[] = [];

    // If status changes, compact the source column.
    if (newStatus !== oldStatus) {
      ops.push(
        this.prisma.task.updateMany({
          where: { teamId, status: oldStatus, position: { gt: oldPosition } },
          data: { position: { decrement: 1 } },
        }),
      );
    }

    // Resolve target position. If unspecified, append to the new column.
    let targetPosition: number;
    if (requestedPosition === undefined) {
      const count = await this.prisma.task.count({
        where: { teamId, status: newStatus, id: { not: id } },
      });
      targetPosition = count;
    } else {
      const maxAllowed = await this.prisma.task.count({
        where: { teamId, status: newStatus, id: { not: id } },
      });
      targetPosition = Math.min(requestedPosition, maxAllowed);
    }

    // Make room in the destination column.
    const destinationFilter: Prisma.TaskWhereInput = {
      teamId,
      status: newStatus,
      id: { not: id },
      position: { gte: targetPosition },
    };
    ops.push(
      this.prisma.task.updateMany({
        where: destinationFilter,
        data: { position: { increment: 1 } },
      }),
    );

    // If moving within the same column, the above already shifted others; just place us.
    ops.push(
      this.prisma.task.update({
        where: { id },
        data: {
          status: newStatus,
          position: targetPosition,
          title: dto.title,
          description: dto.description,
          priority: dto.priority,
          assigneeUserId:
            dto.assigneeUserId === undefined ? undefined : dto.assigneeUserId,
          dueDate:
            dto.dueDate === undefined ? undefined : dto.dueDate ? new Date(dto.dueDate) : null,
          labels: dto.labels,
        },
      }),
    );

    const results = await this.prisma.$transaction(ops);
    return results[results.length - 1] as Task;
  }
}
