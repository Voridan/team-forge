/**
 * Mirror of the publisher contract in
 * api/src/modules/messaging/messaging.publisher.ts.
 * Keep these two files in sync.
 */
export type MessagingEvent =
  | {
      type: 'message:created';
      channelId: string;
      teamId: string;
      payload: unknown;
    }
  | {
      type: 'message:edited';
      channelId: string;
      teamId: string;
      payload: unknown;
    }
  | {
      type: 'message:deleted';
      channelId: string;
      teamId: string;
      messageId: string;
    };

export interface ChannelMembership {
  channelId: string;
  teamId: string;
}

/**
 * Mirror of api/src/modules/calls/calls.types.ts. Keep in sync.
 */
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
      participant: {
        userId: string;
        firstName: string;
        lastName: string;
        avatarUrl: string | null;
        joinedAt: string;
      };
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
