/**
 * Behavioural tests for the presence gateway. Like the typing gateway, this
 * module owns in-memory state — we re-import per test to reset it.
 */

describe('presence.gateway', () => {
  let attachPresenceGateway: typeof import('./presence.gateway').attachPresenceGateway;
  let getOnlineUserIds: typeof import('./presence.gateway').getOnlineUserIds;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    const mod = require('./presence.gateway');
    attachPresenceGateway = mod.attachPresenceGateway;
    getOnlineUserIds = mod.getOnlineUserIds;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function makeServer() {
    return { /* no methods needed — emits go through socket.to(...) */ } as never;
  }

  function makeSocket(opts: {
    userId: string | undefined;
    socketId: string;
    rooms: string[];
  }) {
    const emit = jest.fn();
    const except = jest.fn(() => ({ emit }));
    const handlers: Record<string, () => void> = {};
    return {
      id: opts.socketId,
      data: opts.userId ? { user: { id: opts.userId, email: 'a@b.com' } } : {},
      rooms: new Set<string>([opts.socketId, ...opts.rooms]),
      to: jest.fn(() => ({ except })),
      on(event: string, handler: () => void) {
        handlers[event] = handler;
      },
      fire(event: string) {
        handlers[event]?.();
      },
      _emit: emit,
      _except: except,
    };
  }

  function flush() {
    // presence.gateway uses setImmediate to defer the ONLINE broadcast.
    jest.runOnlyPendingTimers();
  }

  it('broadcasts ONLINE on the first socket for a user', () => {
    const wire = attachPresenceGateway(makeServer());
    const socket = makeSocket({ userId: 'user-A', socketId: 'sA', rooms: ['team:T1'] });
    wire(socket as never);

    flush();

    expect(socket.to).toHaveBeenCalledWith(['team:T1']);
    expect(socket._except).toHaveBeenCalledWith('sA');
    expect(socket._emit).toHaveBeenCalledWith('presence:changed', {
      userId: 'user-A',
      status: 'ONLINE',
    });
    expect(getOnlineUserIds()).toEqual(['user-A']);
  });

  it('does NOT re-broadcast ONLINE on a second socket for the same user', () => {
    const wire = attachPresenceGateway(makeServer());
    const s1 = makeSocket({ userId: 'user-A', socketId: 'sA1', rooms: ['team:T1'] });
    const s2 = makeSocket({ userId: 'user-A', socketId: 'sA2', rooms: ['team:T1'] });
    wire(s1 as never);
    flush();
    wire(s2 as never);
    flush();

    expect(s1._emit).toHaveBeenCalledTimes(1);
    expect(s2._emit).toHaveBeenCalledTimes(0); // no broadcast — already online
  });

  it('keeps user ONLINE while another socket is still connected', () => {
    const wire = attachPresenceGateway(makeServer());
    const s1 = makeSocket({ userId: 'user-A', socketId: 'sA1', rooms: ['team:T1'] });
    const s2 = makeSocket({ userId: 'user-A', socketId: 'sA2', rooms: ['team:T1'] });
    wire(s1 as never);
    wire(s2 as never);
    flush();

    s1.fire('disconnect');

    // Still online — second socket is connected.
    expect(getOnlineUserIds()).toEqual(['user-A']);
    // No OFFLINE broadcast either.
    expect(s1._emit).toHaveBeenCalledTimes(1); // only the initial ONLINE
    expect(s2._emit).not.toHaveBeenCalled();
  });

  it('broadcasts OFFLINE when the last socket for a user disconnects', () => {
    const wire = attachPresenceGateway(makeServer());
    const socket = makeSocket({ userId: 'user-A', socketId: 'sA', rooms: ['team:T1'] });
    wire(socket as never);
    flush();

    socket.fire('disconnect');

    expect(socket._emit).toHaveBeenCalledTimes(2);
    expect(socket._emit).toHaveBeenLastCalledWith('presence:changed', {
      userId: 'user-A',
      status: 'OFFLINE',
    });
    expect(getOnlineUserIds()).toEqual([]);
  });

  it('falls back to broadcasting to channel rooms when no team room is joined', () => {
    const wire = attachPresenceGateway(makeServer());
    const socket = makeSocket({
      userId: 'user-A',
      socketId: 'sA',
      rooms: ['channel:c1', 'channel:c2'],
    });
    wire(socket as never);
    flush();

    expect(socket.to).toHaveBeenCalledWith(['channel:c1', 'channel:c2']);
    expect(socket._emit).toHaveBeenCalledWith(
      'presence:changed',
      expect.objectContaining({ status: 'ONLINE' }),
    );
  });

  it('silently ignores sockets without an authenticated user', () => {
    const wire = attachPresenceGateway(makeServer());
    const socket = makeSocket({ userId: undefined, socketId: 's-unauth', rooms: [] });
    wire(socket as never);
    flush();

    expect(socket._emit).not.toHaveBeenCalled();
    expect(getOnlineUserIds()).toEqual([]);
  });
});
