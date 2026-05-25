import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  Call,
  CallParticipant,
  CallStatus,
  Prisma,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CallsPublisher } from './calls.publisher';
import {
  ActiveCallView,
  CallHistoryItem,
  CallParticipantSummary,
  CallStarter,
  CallTokenView,
} from './calls.types';
import { LivekitService } from './livekit.service';

interface ListHistoryFilters {
  limit?: number;
  cursor?: string;
}

export interface CallHistoryPage {
  items: CallHistoryItem[];
  nextCursor: string | null;
}

const callWithRelations = Prisma.validator<Prisma.CallDefaultArgs>()({
  include: {
    startedBy: {
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
    },
    participants: {
      include: {
        member: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatarUrl: true },
            },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    },
  },
});

type CallWithRelations = Prisma.CallGetPayload<typeof callWithRelations>;

@Injectable()
export class CallsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly livekit: LivekitService,
    private readonly publisher: CallsPublisher,
  ) {}

  async start(teamId: string, userId: string): Promise<CallTokenView> {
    const existing = await this.prisma.call.findFirst({
      where: { teamId, status: CallStatus.ACTIVE },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('A call is already active in this team');
    }

    const starter = await this.requireTeamUser(teamId, userId);

    const callId = randomUUID();
    const roomName = buildRoomName(teamId, callId);

    await this.prisma.call.create({
      data: {
        id: callId,
        teamId,
        status: CallStatus.ACTIVE,
        roomName,
        startedByUserId: userId,
      },
    });

    const token = await this.livekit.signParticipantToken({
      roomName,
      userId,
      displayName: `${starter.firstName} ${starter.lastName}`.trim(),
    });

    await this.publisher.publish({
      type: 'call:incoming',
      teamId,
      callId,
      callerId: userId,
    });

    const call = await this.findCallWithRelationsOrThrow(teamId, callId);
    return {
      ...toActiveView(call),
      livekitUrl: this.livekit.url,
      token,
    };
  }

  async join(teamId: string, callId: string, userId: string): Promise<CallTokenView> {
    const call = await this.findCallWithRelationsOrThrow(teamId, callId);
    if (call.status !== CallStatus.ACTIVE) {
      throw new ConflictException('Call has ended');
    }

    const joiner = await this.requireTeamUser(teamId, userId);
    const token = await this.livekit.signParticipantToken({
      roomName: call.roomName,
      userId,
      displayName: `${joiner.firstName} ${joiner.lastName}`.trim(),
    });

    return {
      ...toActiveView(call),
      livekitUrl: this.livekit.url,
      token,
    };
  }

  /**
   * Best-effort marker — the LiveKit `participant_left` webhook is the
   * authoritative signal. We update leftAt here so the local view reflects the
   * leave immediately, even before the webhook arrives.
   */
  async leave(teamId: string, callId: string, userId: string): Promise<void> {
    await this.prisma.callParticipant.updateMany({
      where: { callId, teamId, userId, leftAt: null },
      data: { leftAt: new Date() },
    });
  }

  async getActive(teamId: string): Promise<ActiveCallView | null> {
    const call = await this.prisma.call.findFirst({
      where: { teamId, status: CallStatus.ACTIVE },
      ...callWithRelations,
    });
    return call ? toActiveView(call) : null;
  }

  async getById(teamId: string, callId: string): Promise<ActiveCallView> {
    const call = await this.findCallWithRelationsOrThrow(teamId, callId);
    return toActiveView(call);
  }

  async listHistory(teamId: string, filters: ListHistoryFilters): Promise<CallHistoryPage> {
    const limit = filters.limit ?? 25;
    const cursor = parseCursor(filters.cursor);

    const where: Prisma.CallWhereInput = { teamId, status: CallStatus.ENDED };
    if (cursor) {
      where.OR = [
        { startedAt: { lt: cursor.startedAt } },
        { startedAt: cursor.startedAt, id: { lt: cursor.id } },
      ];
    }

    const calls = await this.prisma.call.findMany({
      where,
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: {
        startedBy: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatarUrl: true },
            },
          },
        },
        _count: { select: { participants: true } },
      },
    });

    let nextCursor: string | null = null;
    if (calls.length > limit) {
      const next = calls.pop()!;
      nextCursor = encodeCursor({ startedAt: next.startedAt, id: next.id });
    }

    return {
      items: calls.map((c) => ({
        callId: c.id,
        roomName: c.roomName,
        startedAt: c.startedAt,
        endedAt: c.endedAt,
        durationSec: c.durationSec,
        startedBy: c.startedBy ? toStarter(c.startedBy.user) : null,
        participantCount: c._count.participants,
      })),
      nextCursor,
    };
  }

  // --- webhook-driven mutations (called from LivekitWebhookController) ---

  async recordParticipantJoined(
    teamId: string,
    callId: string,
    userId: string,
  ): Promise<CallParticipantSummary | null> {
    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
    });
    if (!member) return null;

    const participant = await this.prisma.callParticipant.upsert({
      where: { callId_userId: { callId, userId } },
      create: { callId, teamId, userId },
      update: { leftAt: null },
    });

    return {
      userId: member.user.id,
      firstName: member.user.firstName,
      lastName: member.user.lastName,
      avatarUrl: member.user.avatarUrl,
      joinedAt: participant.joinedAt.toISOString(),
    };
  }

  async recordParticipantLeft(callId: string, userId: string): Promise<boolean> {
    const result = await this.prisma.callParticipant.updateMany({
      where: { callId, userId, leftAt: null },
      data: { leftAt: new Date() },
    });
    return result.count > 0;
  }

  async recordRoomFinished(callId: string): Promise<Call | null> {
    const existing = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!existing || existing.status === CallStatus.ENDED) return null;

    const endedAt = new Date();
    const durationSec = Math.max(
      0,
      Math.round((endedAt.getTime() - existing.startedAt.getTime()) / 1000),
    );
    return this.prisma.call.update({
      where: { id: callId },
      data: { status: CallStatus.ENDED, endedAt, durationSec },
    });
  }

  // --- helpers ---

  private async findCallWithRelationsOrThrow(
    teamId: string,
    callId: string,
  ): Promise<CallWithRelations> {
    const call = await this.prisma.call.findFirst({
      where: { id: callId, teamId },
      ...callWithRelations,
    });
    if (!call) throw new NotFoundException('Call not found');
    return call;
  }

  private async requireTeamUser(
    teamId: string,
    userId: string,
  ): Promise<{ firstName: string; lastName: string }> {
    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    if (!member) throw new NotFoundException('User is not a member of this team');
    return { firstName: member.user.firstName, lastName: member.user.lastName };
  }
}

function buildRoomName(teamId: string, callId: string): string {
  return `team-${teamId}-${callId}`;
}

/**
 * Inverse of buildRoomName — webhook events arrive with only the room name,
 * so we recover the callId for DB lookups. Returns null if the room wasn't
 * minted by us (e.g. someone created a room manually via LiveKit dashboard).
 */
export function parseRoomName(roomName: string): { teamId: string; callId: string } | null {
  const match = /^team-([0-9a-f-]{36})-([0-9a-f-]{36})$/i.exec(roomName);
  if (!match) return null;
  return { teamId: match[1], callId: match[2] };
}

function toActiveView(call: CallWithRelations): ActiveCallView {
  return {
    callId: call.id,
    roomName: call.roomName,
    startedAt: call.startedAt,
    startedBy: call.startedBy ? toStarter(call.startedBy.user) : null,
    participants: call.participants
      .filter((p) => p.leftAt === null)
      .map(toParticipantSummary),
  };
}

function toStarter(user: {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}): CallStarter {
  return {
    userId: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
  };
}

function toParticipantSummary(
  p: CallParticipant & {
    member: {
      user: { id: string; firstName: string; lastName: string; avatarUrl: string | null };
    };
  },
): CallParticipantSummary {
  return {
    userId: p.member.user.id,
    firstName: p.member.user.firstName,
    lastName: p.member.user.lastName,
    avatarUrl: p.member.user.avatarUrl,
    joinedAt: p.joinedAt.toISOString(),
  };
}

function parseCursor(raw?: string): { startedAt: Date; id: string } | null {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const { s, i } = JSON.parse(decoded) as { s: string; i: string };
    return { startedAt: new Date(s), id: i };
  } catch {
    return null;
  }
}

function encodeCursor(cursor: { startedAt: Date; id: string }): string {
  return Buffer.from(
    JSON.stringify({ s: cursor.startedAt.toISOString(), i: cursor.id }),
    'utf8',
  ).toString('base64url');
}
