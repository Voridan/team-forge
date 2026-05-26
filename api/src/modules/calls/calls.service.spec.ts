import { ConflictException, NotFoundException } from '@nestjs/common';
import { CallStatus } from '../../../generated/prisma/client';
import { CallsService, parseRoomName } from './calls.service';

type MockPrisma = {
  call: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  callParticipant: {
    upsert: jest.Mock;
    updateMany: jest.Mock;
  };
  teamMember: {
    findUnique: jest.Mock;
  };
};

type MockLivekit = {
  signParticipantToken: jest.Mock;
  url: string;
};

type MockPublisher = {
  publish: jest.Mock;
};

function makeMocks(): { prisma: MockPrisma; livekit: MockLivekit; publisher: MockPublisher } {
  return {
    prisma: {
      call: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      callParticipant: {
        upsert: jest.fn(),
        updateMany: jest.fn(),
      },
      teamMember: {
        findUnique: jest.fn(),
      },
    },
    livekit: {
      signParticipantToken: jest.fn(),
      url: 'ws://localhost:7880',
    },
    publisher: {
      publish: jest.fn(),
    },
  };
}

const TEAM_ID = '11111111-1111-1111-1111-111111111111';
const CALL_ID = '22222222-2222-2222-2222-222222222222';
const USER_ID = '33333333-3333-3333-3333-333333333333';

const baseMember = {
  teamId: TEAM_ID,
  userId: USER_ID,
  role: 'MEMBER',
  joinedAt: new Date(),
  user: { id: USER_ID, firstName: 'Alice', lastName: 'Chen', avatarUrl: null },
};

const baseCall = {
  id: CALL_ID,
  teamId: TEAM_ID,
  status: CallStatus.ACTIVE,
  roomName: `team-${TEAM_ID}-${CALL_ID}`,
  startedByUserId: USER_ID,
  startedAt: new Date('2026-01-01T10:00:00Z'),
  endedAt: null,
  durationSec: null,
  startedBy: {
    user: baseMember.user,
  },
  participants: [],
};

describe('CallsService', () => {
  let prisma: MockPrisma;
  let livekit: MockLivekit;
  let publisher: MockPublisher;
  let service: CallsService;

  beforeEach(() => {
    ({ prisma, livekit, publisher } = makeMocks());
    service = new CallsService(prisma as never, livekit as never, publisher as never);
  });

  describe('start', () => {
    it('rejects when a call is already active for the team', async () => {
      prisma.call.findFirst.mockResolvedValue({ id: CALL_ID });

      await expect(service.start(TEAM_ID, USER_ID)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.call.create).not.toHaveBeenCalled();
    });

    it('creates the call + signs a token + publishes call:incoming on the happy path', async () => {
      prisma.call.findFirst
        .mockResolvedValueOnce(null) // no active call
        .mockResolvedValueOnce(baseCall); // findCallWithRelationsOrThrow
      prisma.teamMember.findUnique.mockResolvedValue(baseMember);
      prisma.call.create.mockResolvedValue(baseCall);
      livekit.signParticipantToken.mockResolvedValue('jwt-token');

      const result = await service.start(TEAM_ID, USER_ID);

      expect(prisma.call.create).toHaveBeenCalledTimes(1);
      expect(livekit.signParticipantToken).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER_ID, displayName: 'Alice Chen' }),
      );
      expect(publisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'call:incoming', teamId: TEAM_ID }),
      );
      expect(result.token).toBe('jwt-token');
      expect(result.livekitUrl).toBe('ws://localhost:7880');
    });

    it('rejects if the starter is not a member of the team', async () => {
      prisma.call.findFirst.mockResolvedValue(null);
      prisma.teamMember.findUnique.mockResolvedValue(null);

      await expect(service.start(TEAM_ID, USER_ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('join', () => {
    it('throws NotFoundException when the call is missing', async () => {
      prisma.call.findFirst.mockResolvedValue(null);

      await expect(service.join(TEAM_ID, CALL_ID, USER_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects when the call has already ended', async () => {
      prisma.call.findFirst.mockResolvedValue({ ...baseCall, status: CallStatus.ENDED });

      await expect(service.join(TEAM_ID, CALL_ID, USER_ID)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('signs a token and returns the active view on the happy path', async () => {
      prisma.call.findFirst.mockResolvedValue(baseCall);
      prisma.teamMember.findUnique.mockResolvedValue(baseMember);
      livekit.signParticipantToken.mockResolvedValue('joiner-token');

      const result = await service.join(TEAM_ID, CALL_ID, USER_ID);

      expect(livekit.signParticipantToken).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER_ID, displayName: 'Alice Chen' }),
      );
      expect(result.token).toBe('joiner-token');
    });
  });

  describe('leave', () => {
    it('marks the current participant as left for this call', async () => {
      prisma.callParticipant.updateMany.mockResolvedValue({ count: 1 });

      await service.leave(TEAM_ID, CALL_ID, USER_ID);

      expect(prisma.callParticipant.updateMany).toHaveBeenCalledWith({
        where: { callId: CALL_ID, teamId: TEAM_ID, userId: USER_ID, leftAt: null },
        data: { leftAt: expect.any(Date) },
      });
    });
  });

  describe('recordParticipantJoined (webhook handler)', () => {
    it('returns null when the user is not a member of the team', async () => {
      prisma.teamMember.findUnique.mockResolvedValue(null);

      const result = await service.recordParticipantJoined(TEAM_ID, CALL_ID, USER_ID);

      expect(result).toBeNull();
      expect(prisma.callParticipant.upsert).not.toHaveBeenCalled();
    });

    it('upserts the participant row and returns a summary', async () => {
      prisma.teamMember.findUnique.mockResolvedValue(baseMember);
      prisma.callParticipant.upsert.mockResolvedValue({
        callId: CALL_ID,
        teamId: TEAM_ID,
        userId: USER_ID,
        joinedAt: new Date(),
        leftAt: null,
      });

      const result = await service.recordParticipantJoined(TEAM_ID, CALL_ID, USER_ID);

      expect(prisma.callParticipant.upsert).toHaveBeenCalledWith({
        where: { callId_userId: { callId: CALL_ID, userId: USER_ID } },
        create: { callId: CALL_ID, teamId: TEAM_ID, userId: USER_ID },
        update: { leftAt: null },
      });
      expect(result?.userId).toBe(USER_ID);
    });
  });

  describe('recordParticipantLeft (webhook handler)', () => {
    it('returns true when a participant row was updated', async () => {
      prisma.callParticipant.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.recordParticipantLeft(CALL_ID, USER_ID);

      expect(result).toBe(true);
    });

    it('returns false when no row matched (already left or never joined)', async () => {
      prisma.callParticipant.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.recordParticipantLeft(CALL_ID, USER_ID);

      expect(result).toBe(false);
    });
  });

  describe('recordRoomFinished (webhook handler)', () => {
    it('returns null when the call no longer exists', async () => {
      prisma.call.findUnique.mockResolvedValue(null);

      const result = await service.recordRoomFinished(CALL_ID);

      expect(result).toBeNull();
      expect(prisma.call.update).not.toHaveBeenCalled();
    });

    it('returns null when the call has already ended (idempotent)', async () => {
      prisma.call.findUnique.mockResolvedValue({ ...baseCall, status: CallStatus.ENDED });

      const result = await service.recordRoomFinished(CALL_ID);

      expect(result).toBeNull();
      expect(prisma.call.update).not.toHaveBeenCalled();
    });

    it('sets endedAt + durationSec on the happy path', async () => {
      const startedAt = new Date('2026-01-01T10:00:00Z');
      prisma.call.findUnique.mockResolvedValue({ ...baseCall, startedAt, status: CallStatus.ACTIVE });
      prisma.call.update.mockResolvedValue({
        ...baseCall,
        status: CallStatus.ENDED,
        endedAt: new Date(),
        durationSec: 100,
      });

      await service.recordRoomFinished(CALL_ID);

      expect(prisma.call.update).toHaveBeenCalledWith({
        where: { id: CALL_ID },
        data: expect.objectContaining({
          status: CallStatus.ENDED,
          endedAt: expect.any(Date),
          durationSec: expect.any(Number),
        }),
      });
    });
  });
});

describe('parseRoomName', () => {
  it('parses a well-formed room name', () => {
    const room = `team-${TEAM_ID}-${CALL_ID}`;
    const parsed = parseRoomName(room);
    expect(parsed).toEqual({ teamId: TEAM_ID, callId: CALL_ID });
  });

  it('returns null for an unrelated room name', () => {
    expect(parseRoomName('something-else')).toBeNull();
    expect(parseRoomName('team-abc-def')).toBeNull();
  });
});
