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
