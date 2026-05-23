import type { Server, Socket } from 'socket.io';

const TYPING_TIMEOUT_MS = 5_000;

interface TypingPayload {
  channelId: string;
}

/**
 * Per-instance typing state. For multi-instance deployments swap this for a
 * Redis-backed map (e.g. SET "typing:{channelId}" {userId} EX 5).
 *
 * Map<channelId, Map<userId, autoStopTimer>>
 */
const typingByChannel = new Map<string, Map<string, NodeJS.Timeout>>();

function setTyping(channelId: string, userId: string, timer: NodeJS.Timeout): void {
  let inner = typingByChannel.get(channelId);
  if (!inner) {
    inner = new Map();
    typingByChannel.set(channelId, inner);
  }
  inner.set(userId, timer);
}

function clearTyping(channelId: string, userId: string): boolean {
  const inner = typingByChannel.get(channelId);
  if (!inner) return false;
  const existing = inner.get(userId);
  if (!existing) return false;
  clearTimeout(existing);
  inner.delete(userId);
  if (inner.size === 0) typingByChannel.delete(channelId);
  return true;
}

function isCurrentlyTyping(channelId: string, userId: string): boolean {
  return typingByChannel.get(channelId)?.has(userId) ?? false;
}

function validate(value: unknown): TypingPayload | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as { channelId?: unknown };
  if (typeof v.channelId !== 'string' || v.channelId.length === 0) return null;
  return { channelId: v.channelId };
}

/**
 * Wires per-socket typing handlers. The Socket.IO room (`channel:<id>`) controls
 * which clients receive a `typing:update`; this gateway only handles incoming
 * `typing:start` / `typing:stop` from the same socket's user.
 *
 * Each `typing:start` (re)sets a 5s timer that auto-fires `typing:stop` if the
 * client falls silent without sending an explicit stop.
 */
export function attachTypingGateway(io: Server): (socket: Socket) => void {
  return (socket: Socket) => {
    const userId = socket.data.user?.id;
    if (!userId) return;

    const stop = (channelId: string) => {
      if (!clearTyping(channelId, userId)) return; // not currently typing — no-op
      io.to(`channel:${channelId}`)
        .except(socket.id)
        .emit('typing:update', { channelId, userId, isTyping: false });
    };

    socket.on('typing:start', (raw: unknown) => {
      const payload = validate(raw);
      if (!payload) return;
      // Only the rooms the socket joined on connect are valid channels.
      if (!socket.rooms.has(`channel:${payload.channelId}`)) return;

      const alreadyTyping = isCurrentlyTyping(payload.channelId, userId);
      // Always refresh the auto-stop timer.
      const timer = setTimeout(() => stop(payload.channelId), TYPING_TIMEOUT_MS);
      const previous = typingByChannel.get(payload.channelId)?.get(userId);
      if (previous) clearTimeout(previous);
      setTyping(payload.channelId, userId, timer);

      if (!alreadyTyping) {
        io.to(`channel:${payload.channelId}`)
          .except(socket.id)
          .emit('typing:update', { channelId: payload.channelId, userId, isTyping: true });
      }
    });

    socket.on('typing:stop', (raw: unknown) => {
      const payload = validate(raw);
      if (!payload) return;
      stop(payload.channelId);
    });

    socket.on('disconnect', () => {
      // Clear all typing state for this user across every channel.
      for (const channelId of Array.from(typingByChannel.keys())) {
        stop(channelId);
      }
    });
  };
}
