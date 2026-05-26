import { MessagingPublisher } from './messaging.publisher';

const ioredisPublish = jest.fn();
const ioredisQuit = jest.fn();
const ioredisOn = jest.fn();

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    publish: (...args: unknown[]) => ioredisPublish(...args),
    quit: () => ioredisQuit(),
    on: (...args: unknown[]) => ioredisOn(...args),
  })),
);

function makeConfig() {
  return {
    get: jest.fn((key: string) => (key === 'REDIS_URL' ? 'redis://localhost:6379' : undefined)),
  };
}

describe('MessagingPublisher', () => {
  let publisher: MessagingPublisher;

  beforeEach(() => {
    ioredisPublish.mockReset();
    ioredisQuit.mockReset();
    ioredisOn.mockReset();
    publisher = new MessagingPublisher(makeConfig() as never);
    publisher.onModuleInit();
  });

  it('publishes a JSON-encoded event on the channel:<id> topic', async () => {
    ioredisPublish.mockResolvedValue(1);

    const event = {
      type: 'message:created' as const,
      channelId: 'c1',
      teamId: 't1',
      payload: { id: 'm1', content: 'hi' },
    };
    await publisher.publish(event);

    expect(ioredisPublish).toHaveBeenCalledWith('channel:c1', JSON.stringify(event));
  });

  it('does not throw when Redis publish fails (best-effort)', async () => {
    ioredisPublish.mockRejectedValue(new Error('connection refused'));

    await expect(
      publisher.publish({
        type: 'message:deleted',
        channelId: 'c1',
        teamId: 't1',
        messageId: 'm1',
      }),
    ).resolves.toBeUndefined();
  });

  it('disconnects on module destroy', async () => {
    ioredisQuit.mockResolvedValue('OK');
    await publisher.onModuleDestroy();
    expect(ioredisQuit).toHaveBeenCalled();
  });
});
