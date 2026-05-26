import { beforeEach, describe, expect, it } from 'vitest';
import { usePresenceStore } from './presence-store';

describe('presence-store', () => {
  beforeEach(() => {
    usePresenceStore.setState({ byUser: {} });
  });

  it('marks a user ONLINE', () => {
    usePresenceStore.getState().setStatus('user-1', 'ONLINE');
    expect(usePresenceStore.getState().isOnline('user-1')).toBe(true);
    expect(usePresenceStore.getState().byUser).toEqual({ 'user-1': 'ONLINE' });
  });

  it('marks a user OFFLINE', () => {
    usePresenceStore.setState({ byUser: { 'user-1': 'ONLINE' } });
    usePresenceStore.getState().setStatus('user-1', 'OFFLINE');
    expect(usePresenceStore.getState().isOnline('user-1')).toBe(false);
  });

  it('isOnline returns false for unknown users', () => {
    expect(usePresenceStore.getState().isOnline('never-seen')).toBe(false);
  });

  it('returns the same state object reference when status is unchanged (no re-render)', () => {
    usePresenceStore.getState().setStatus('user-1', 'ONLINE');
    const before = usePresenceStore.getState().byUser;
    usePresenceStore.getState().setStatus('user-1', 'ONLINE'); // same value
    const after = usePresenceStore.getState().byUser;
    expect(after).toBe(before); // object identity preserved
  });

  it('changes the state object reference when status actually changes', () => {
    usePresenceStore.getState().setStatus('user-1', 'ONLINE');
    const before = usePresenceStore.getState().byUser;
    usePresenceStore.getState().setStatus('user-1', 'OFFLINE');
    const after = usePresenceStore.getState().byUser;
    expect(after).not.toBe(before);
  });

  it('tracks multiple users independently', () => {
    usePresenceStore.getState().setStatus('user-1', 'ONLINE');
    usePresenceStore.getState().setStatus('user-2', 'ONLINE');
    usePresenceStore.getState().setStatus('user-3', 'OFFLINE');
    expect(usePresenceStore.getState().byUser).toEqual({
      'user-1': 'ONLINE',
      'user-2': 'ONLINE',
      'user-3': 'OFFLINE',
    });
  });

  it('clear() wipes the store', () => {
    usePresenceStore.getState().setStatus('user-1', 'ONLINE');
    usePresenceStore.getState().setStatus('user-2', 'ONLINE');
    usePresenceStore.getState().clear();
    expect(usePresenceStore.getState().byUser).toEqual({});
    expect(usePresenceStore.getState().isOnline('user-1')).toBe(false);
  });
});
