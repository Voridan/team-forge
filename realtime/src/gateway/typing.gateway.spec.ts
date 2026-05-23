/**
 * Behavioural tests for the typing gateway. The gateway has module-level state
 * (the in-memory typing Map), so each test resets fake timers and re-imports
 * the module to guarantee isolation between cases.
 */

const REAL_TIMERS = jest.requireActual<typeof import('timers')>('timers');

describe('typing.gateway', () => {
  let attachTypingGateway: typeof import('./typing.gateway').attachTypingGateway;

  // Re-load the module before each test so module-level state (the Map)
  // is reset. This avoids leakage of typing state across cases.
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    attachTypingGateway = require('./typing.gateway').attachTypingGateway;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function makeServer() {
    const emit = jest.fn();
    const except = jest.fn(() => ({ emit }));
    const to = jest.fn(() => ({ except }));
    const io = { to } as never;
    return { io, to, except, emit };
  }

  function makeSocket(userId: string, socketId = 'sock-1', channelId = 'chan-1') {
    const handlers: Record<string, (raw: unknown) => void> = {};
    return {
      id: socketId,
      data: { user: { id: userId, email: 'a@b.com' } },
      rooms: new Set([`channel:${channelId}`]),
      on(event: string, handler: (raw: unknown) => void) {
        handlers[event] = handler;
      },
      fire(event: string, payload: unknown) {
        handlers[event]?.(payload);
      },
    };
  }

  it('broadcasts typing:update isTyping=true on first typing:start', () => {
    const { io, to, except, emit } = makeServer();
    const wire = attachTypingGateway(io);
    const socket = makeSocket('user-A', 'sock-A');
    wire(socket as never);

    socket.fire('typing:start', { channelId: 'chan-1' });

    expect(to).toHaveBeenCalledWith('channel:chan-1');
    expect(except).toHaveBeenCalledWith('sock-A');
    expect(emit).toHaveBeenCalledWith('typing:update', {
      channelId: 'chan-1',
      userId: 'user-A',
      isTyping: true,
    });
  });

  it('does NOT re-broadcast isTyping=true on consecutive typing:start (debounce)', () => {
    const { io, emit } = makeServer();
    const wire = attachTypingGateway(io);
    const socket = makeSocket('user-A');
    wire(socket as never);

    socket.fire('typing:start', { channelId: 'chan-1' });
    socket.fire('typing:start', { channelId: 'chan-1' });
    socket.fire('typing:start', { channelId: 'chan-1' });

    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('broadcasts isTyping=false after the 5s auto-stop timer fires', () => {
    const { io, emit } = makeServer();
    const wire = attachTypingGateway(io);
    const socket = makeSocket('user-A');
    wire(socket as never);

    socket.fire('typing:start', { channelId: 'chan-1' });
    expect(emit).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(5_000);

    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenLastCalledWith('typing:update', {
      channelId: 'chan-1',
      userId: 'user-A',
      isTyping: false,
    });
  });

  it('resets the auto-stop timer on each typing:start', () => {
    const { io, emit } = makeServer();
    const wire = attachTypingGateway(io);
    const socket = makeSocket('user-A');
    wire(socket as never);

    socket.fire('typing:start', { channelId: 'chan-1' });
    jest.advanceTimersByTime(4_000);
    socket.fire('typing:start', { channelId: 'chan-1' }); // resets the 5s
    jest.advanceTimersByTime(4_000);

    // 8s total but only 4s since the last start — still typing.
    expect(emit).toHaveBeenCalledTimes(1); // only the initial isTyping=true

    jest.advanceTimersByTime(1_000); // now 5s since last start → stop fires
    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenLastCalledWith('typing:update', expect.objectContaining({ isTyping: false }));
  });

  it('typing:stop emits a final isTyping=false and cancels the timer', () => {
    const { io, emit } = makeServer();
    const wire = attachTypingGateway(io);
    const socket = makeSocket('user-A');
    wire(socket as never);

    socket.fire('typing:start', { channelId: 'chan-1' });
    socket.fire('typing:stop', { channelId: 'chan-1' });

    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenNthCalledWith(2, 'typing:update', {
      channelId: 'chan-1',
      userId: 'user-A',
      isTyping: false,
    });

    // After stop, no further emits from the now-canceled auto-timer.
    jest.advanceTimersByTime(10_000);
    expect(emit).toHaveBeenCalledTimes(2);
  });

  it('typing:stop without a prior start is a no-op (no spurious broadcast)', () => {
    const { io, emit } = makeServer();
    const wire = attachTypingGateway(io);
    const socket = makeSocket('user-A');
    wire(socket as never);

    socket.fire('typing:stop', { channelId: 'chan-1' });

    expect(emit).not.toHaveBeenCalled();
  });

  it('rejects typing:start for a channel the socket has not joined', () => {
    const { io, emit } = makeServer();
    const wire = attachTypingGateway(io);
    const socket = makeSocket('user-A', 'sock-A', 'chan-1');
    wire(socket as never);

    socket.fire('typing:start', { channelId: 'other-channel' });

    expect(emit).not.toHaveBeenCalled();
  });

  it('ignores malformed payloads', () => {
    const { io, emit } = makeServer();
    const wire = attachTypingGateway(io);
    const socket = makeSocket('user-A');
    wire(socket as never);

    socket.fire('typing:start', null);
    socket.fire('typing:start', { channelId: 123 });
    socket.fire('typing:start', { channelId: '' });
    socket.fire('typing:start', {});

    expect(emit).not.toHaveBeenCalled();
  });

  it('cleans up typing state on disconnect', () => {
    const { io, emit } = makeServer();
    const wire = attachTypingGateway(io);
    const socket = makeSocket('user-A');
    wire(socket as never);

    socket.fire('typing:start', { channelId: 'chan-1' });
    socket.fire('disconnect', undefined);

    // disconnect should fire a final stop for any active channels.
    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenLastCalledWith('typing:update', expect.objectContaining({ isTyping: false }));

    // No further timer-driven emits.
    jest.advanceTimersByTime(10_000);
    expect(emit).toHaveBeenCalledTimes(2);
  });
});

// Quiet TS — REAL_TIMERS pulled in only to ensure Node's real timer module is available
// when jest.useFakeTimers() in some Jest builds proxies setImmediate.
void REAL_TIMERS;
