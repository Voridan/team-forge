import { useMemo } from 'react';
import type { TeamMemberPublic } from '@/api/types';
import { useAuthStore } from '@/store/auth';
import { useTypingStore } from '@/realtime/typing-store';
import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  channelId: string;
  members: TeamMemberPublic[];
  className?: string;
}

const MAX_NAMES_INLINE = 2;

// Stable empty-array reference. `?? []` inside the Zustand selector would
// allocate a fresh array on every render, breaking useSyncExternalStore's
// snapshot equality check and causing an infinite render loop.
const EMPTY_TYPING_IDS: readonly string[] = [];

export function TypingIndicator({ channelId, members, className }: TypingIndicatorProps) {
  const me = useAuthStore((s) => s.user);
  const typingIds = useTypingStore((s) => s.byChannel[channelId] ?? EMPTY_TYPING_IDS);

  const typingNames = useMemo(() => {
    return typingIds
      .filter((id) => id !== me?.id)
      .map((id) => members.find((m) => m.userId === id))
      .filter((m): m is TeamMemberPublic => !!m)
      .map((m) => m.firstName);
  }, [typingIds, members, me?.id]);

  const visible = typingNames.length > 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-none flex h-5 items-center gap-1.5 px-4 text-[11px] text-muted-foreground transition-opacity duration-200',
        visible ? 'opacity-100' : 'opacity-0',
        className,
      )}
    >
      {visible && (
        <>
          <Dots />
          <span>{formatNames(typingNames)}</span>
        </>
      )}
    </div>
  );
}

function Dots() {
  return (
    <span className="inline-flex items-end gap-[2px]">
      <span className="size-1 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.32s]" />
      <span className="size-1 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.16s]" />
      <span className="size-1 animate-bounce rounded-full bg-muted-foreground" />
    </span>
  );
}

function formatNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  if (names.length <= MAX_NAMES_INLINE + 1) {
    return `${names.slice(0, MAX_NAMES_INLINE).join(', ')}, and ${names[MAX_NAMES_INLINE]} are typing…`;
  }
  const extra = names.length - MAX_NAMES_INLINE;
  return `${names.slice(0, MAX_NAMES_INLINE).join(', ')} and ${extra} others are typing…`;
}
