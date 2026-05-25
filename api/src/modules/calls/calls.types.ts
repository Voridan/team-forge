export type CallEvent =
  | {
      type: 'call:incoming';
      teamId: string;
      callId: string;
      callerId: string;
    }
  | {
      type: 'call:participant-joined';
      teamId: string;
      callId: string;
      participant: CallParticipantSummary;
    }
  | {
      type: 'call:participant-left';
      teamId: string;
      callId: string;
      userId: string;
    }
  | {
      type: 'call:ended';
      teamId: string;
      callId: string;
      durationSec: number;
    };

export interface CallParticipantSummary {
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  joinedAt: string;
}

export interface CallStarter {
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface ActiveCallView {
  callId: string;
  roomName: string;
  startedAt: Date;
  startedBy: CallStarter | null;
  participants: CallParticipantSummary[];
}

export interface CallTokenView extends ActiveCallView {
  livekitUrl: string;
  token: string;
}

export interface CallHistoryItem {
  callId: string;
  roomName: string;
  startedAt: Date;
  endedAt: Date | null;
  durationSec: number | null;
  startedBy: CallStarter | null;
  participantCount: number;
}
