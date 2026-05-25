import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The typing store keeps its auto-clear timers in a module-level Map. Each
 * test needs an isolated module instance, otherwise timers from earlier
 * tests would fire in later tests and confuse expectations.
 */
describe('typing-store', () => {
  let useTypingStore: typeof import('./typing-store').useTypingStore;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    ({ useTypingStore } = await import('./typing-store'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('markTyping adds the user to the channel', () => {
    useTypingStore.getState().markTyping('chan-1', 'user-A');
    expect(useTypingStore.getState().getForChannel('chan-1')).toEqual(['user-A']);
  });

  it('markTyping is idempotent — same (channel,user) twice does not duplicate', () => {
    useTypingStore.getState().markTyping('chan-1', 'user-A');
    useTypingStore.getState().markTyping('chan-1', 'user-A');
    expect(useTypingStore.getState().getForChannel('chan-1')).toEqual(['user-A']);
  });

  it('tracks multiple users in the same channel', () => {
    useTypingStore.getState().markTyping('chan-1', 'user-A');
    useTypingStore.getState().markTyping('chan-1', 'user-B');
    expect(useTypingStore.getState().getForChannel('chan-1').sort()).toEqual(['user-A', 'user-B']);
  });

  it('isolates state across channels', () => {
    useTypingStore.getState().markTyping('chan-1', 'user-A');
    useTypingStore.getState().markTyping('chan-2', 'user-A');
    expect(useTypingStore.getState().getForChannel('chan-1')).toEqual(['user-A']);
    expect(useTypingStore.getState().getForChannel('chan-2')).toEqual(['user-A']);
  });

  it('markStopped removes the user', () => {
    useTypingStore.getState().markTyping('chan-1', 'user-A');
    useTypingStore.getState().markStopped('chan-1', 'user-A');
    expect(useTypingStore.getState().getForChannel('chan-1')).toEqual([]);
  });

  it('markStopped for a non-typing user is a no-op', () => {
    useTypingStore.getState().markStopped('chan-1', 'user-A');
    expect(useTypingStore.getState().getForChannel('chan-1')).toEqual([]);
  });

  it('auto-clears the user after the TTL (6s)', () => {
    useTypingStore.getState().markTyping('chan-1', 'user-A');
    expect(useTypingStore.getState().getForChannel('chan-1')).toEqual(['user-A']);

    vi.advanceTimersByTime(6_001);

    expect(useTypingStore.getState().getForChannel('chan-1')).toEqual([]);
  });

  it('resets the TTL on each markTyping (keeps user typing while events continue)', () => {
    useTypingStore.getState().markTyping('chan-1', 'user-A');
    vi.advanceTimersByTime(5_000);
    useTypingStore.getState().markTyping('chan-1', 'user-A'); // reset to 6s from now
    vi.advanceTimersByTime(5_000);

    // 10s total but only 5s since the last reset — still typing.
    expect(useTypingStore.getState().getForChannel('chan-1')).toEqual(['user-A']);

    vi.advanceTimersByTime(1_500); // now past the TTL
    expect(useTypingStore.getState().getForChannel('chan-1')).toEqual([]);
  });

  it('clears the empty channel key entirely when the last user stops', () => {
    useTypingStore.getState().markTyping('chan-1', 'user-A');
    useTypingStore.getState().markStopped('chan-1', 'user-A');
    expect(useTypingStore.getState().byChannel).toEqual({}); // key removed, not just empty array
  });

  it('cancels the auto-clear timer when markStopped is called', () => {
    useTypingStore.getState().markTyping('chan-1', 'user-A');
    useTypingStore.getState().markStopped('chan-1', 'user-A');

    vi.advanceTimersByTime(10_000); // would auto-clear if timer was still set

    // Should remain empty — the timer must not have fired a second time after manual clear.
    expect(useTypingStore.getState().getForChannel('chan-1')).toEqual([]);
  });
});
