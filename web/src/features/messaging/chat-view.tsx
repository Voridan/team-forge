import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  differenceInMinutes,
  format,
  isToday,
  isYesterday,
  parseISO,
  startOfDay,
} from 'date-fns';
import { ArrowDown, Hash, Loader2, MessagesSquare } from 'lucide-react';
import type { Message, TeamMemberPublic, TeamRole } from '@/api/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';
import { useChannelQuery, useMessagesQuery } from './queries';
import { MessageComposer } from './message-composer';
import { MessageRow } from './message-row';

const ROLE_LEVEL: Record<TeamRole, number> = {
  GUEST: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4,
};

const MAX_MINUTES_TO_GROUP_BY_AUTHOR = 5;
const SCROLL_PIN_THRESHOLD_PX = 80;

interface ChatViewProps {
  teamId: string;
  channelId: string | null;
  members: TeamMemberPublic[];
  myRole: TeamRole | undefined;
}

export function ChatView({ teamId, channelId, members, myRole }: ChatViewProps) {
  const me = useAuthStore((s) => s.user);
  const { data: channel } = useChannelQuery(teamId, channelId);
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useMessagesQuery(teamId, channelId);

  const messages = useMemo(() => {
    if (!data) return [];
    return [...data.pages.flatMap((p) => p.items)].reverse();
  }, [data]);

  const memberLookup = useMemo(
    () => new Map(members.map((m) => [m.userId, m])),
    [members],
  );

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const previousLastIdRef = useRef<string | null>(null);
  const wasAtBottomRef = useRef(true);
  const [showNewPill, setShowNewPill] = useState(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    setShowNewPill(false);
    wasAtBottomRef.current = true;
  }, []);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    wasAtBottomRef.current = distanceFromBottom < SCROLL_PIN_THRESHOLD_PX;
    if (wasAtBottomRef.current && showNewPill) setShowNewPill(false);
  };

  // On message arrival: stick to bottom if user was there; otherwise surface the pill.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || messages.length === 0) return;
    const newestId = messages[messages.length - 1]?.id ?? null;
    const isFirstLoad = previousLastIdRef.current === null;
    const isNewArrival = newestId !== previousLastIdRef.current;

    if (isFirstLoad) {
      el.scrollTop = el.scrollHeight;
    } else if (isNewArrival) {
      if (wasAtBottomRef.current) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      } else {
        const author = messages[messages.length - 1]?.authorUserId;
        // Don't pop the pill for the user's own outgoing messages.
        if (author !== me?.id) setShowNewPill(true);
      }
    }
    previousLastIdRef.current = newestId;
  }, [messages, me?.id]);

  // Reset state when switching channels.
  useEffect(() => {
    previousLastIdRef.current = null;
    wasAtBottomRef.current = true;
    setShowNewPill(false);
  }, [channelId]);

  if (!channelId) {
    return <PickChannelState />;
  }

  const canDeleteAsAdmin = myRole ? ROLE_LEVEL[myRole] >= ROLE_LEVEL.ADMIN : false;
  const grouped = groupByDay(messages);

  return (
    <section className="relative flex flex-1 flex-col">
      <header className="flex h-12 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
        <Hash className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold tracking-tight">
          {channel?.name ?? '…'}
        </h2>
        {channel?.description && (
          <span
            className="ml-1 hidden truncate border-l pl-3 text-xs text-muted-foreground sm:block"
            title={channel.description}
          >
            {channel.description}
          </span>
        )}
      </header>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative flex-1 overflow-y-auto bg-background scrollbar-thin"
      >
        {hasNextPage && (
          <div className="flex items-center justify-center py-2">
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
            >
              {isFetchingNextPage && <Loader2 className="size-3 animate-spin" />}
              {isFetchingNextPage ? 'Loading…' : 'Load earlier messages'}
            </button>
          </div>
        )}

        {isLoading ? (
          <MessagesSkeleton />
        ) : messages.length === 0 ? (
          <EmptyChannelState
            channelName={channel?.name ?? ''}
            description={channel?.description ?? null}
          />
        ) : (
          <div className="pb-3 pt-1">
            {grouped.map((group) => (
              <div key={group.dayKey}>
                <DaySeparator date={group.date} />
                {group.messages.map((m, i) => (
                  <MessageRow
                    key={m.id}
                    teamId={teamId}
                    channelId={channelId}
                    message={m}
                    member={m.authorUserId ? (memberLookup.get(m.authorUserId) ?? null) : null}
                    isAuthor={m.authorUserId === me?.id}
                    canDeleteAsAdmin={canDeleteAsAdmin}
                    showHeader={shouldShowHeader(group.messages, i)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-[5.25rem] z-10 flex justify-center transition-all duration-200',
          showNewPill ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        )}
      >
        <button
          type="button"
          onClick={() => scrollToBottom('smooth')}
          className={cn(
            'pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-lg',
            'transition-transform hover:scale-[1.02] active:scale-[0.98]',
          )}
        >
          <ArrowDown className="size-3.5" />
          New messages
        </button>
      </div>

      <MessageComposer
        teamId={teamId}
        channelId={channelId}
        channelName={channel?.name ?? ''}
      />
    </section>
  );
}

// --- helpers ---

interface DayGroup {
  dayKey: string;
  date: Date;
  messages: Message[];
}

function groupByDay(messages: Message[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const message of messages) {
    const date = startOfDay(parseISO(message.createdAt));
    const dayKey = date.toISOString();
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.dayKey === dayKey) {
      lastGroup.messages.push(message);
    } else {
      groups.push({ dayKey, date, messages: [message] });
    }
  }
  return groups;
}

function shouldShowHeader(messages: Message[], i: number): boolean {
  if (i === 0) return true;
  const prev = messages[i - 1];
  const curr = messages[i];
  if (prev.authorUserId !== curr.authorUserId) return true;
  const gap = Math.abs(
    differenceInMinutes(parseISO(curr.createdAt), parseISO(prev.createdAt)),
  );
  return gap > MAX_MINUTES_TO_GROUP_BY_AUTHOR;
}

function DaySeparator({ date }: { date: Date }) {
  const label = isToday(date)
    ? 'Today'
    : isYesterday(date)
      ? 'Yesterday'
      : format(date, 'EEE, MMM d');
  return (
    <div
      className="sticky top-0 z-[1] my-2 flex items-center gap-3 px-4 py-1"
      aria-label={label}
    >
      <div className="h-px flex-1 bg-border/60" />
      <span className="rounded-full bg-card px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground ring-1 ring-border">
        {label}
      </span>
      <div className="h-px flex-1 bg-border/60" />
    </div>
  );
}

// Varying widths to feel less mechanical while loading.
function MessagesSkeleton() {
  const variants: Array<'short' | 'medium' | 'long' | 'multi'> = [
    'medium',
    'short',
    'long',
    'medium',
    'multi',
    'short',
  ];
  return (
    <div className="space-y-5 px-4 py-4">
      {variants.map((variant, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2.5 w-12 opacity-60" />
            </div>
            {variant === 'short' && <Skeleton className="h-3 w-32" />}
            {variant === 'medium' && <Skeleton className="h-3 w-2/3" />}
            {variant === 'long' && (
              <>
                <Skeleton className="h-3 w-11/12" />
                <Skeleton className="h-3 w-2/3" />
              </>
            )}
            {variant === 'multi' && (
              <>
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-10 w-44 rounded-lg" />
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyChannelState({
  channelName,
  description,
}: {
  channelName: string;
  description: string | null;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 pb-12 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-primary/10">
        <Hash className="size-5 text-primary" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold tracking-tight">
          Welcome to #{channelName}
        </p>
        {description ? (
          <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
        ) : (
          <p className="max-w-sm text-sm text-muted-foreground">
            This is the start of the channel. Be the first to say something.
          </p>
        )}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        <kbd className="rounded bg-secondary px-1 font-mono">↵</kbd> sends · drag a file to attach
      </p>
    </div>
  );
}

function PickChannelState() {
  return (
    <section className="flex flex-1 items-center justify-center bg-background">
      <div className="flex max-w-xs flex-col items-center gap-3 text-center text-muted-foreground">
        <div className="grid size-12 place-items-center rounded-2xl bg-secondary">
          <MessagesSquare className="size-5" />
        </div>
        <p className="text-sm text-foreground">Pick a channel</p>
        <p className="text-xs">
          Channels keep conversation grouped. Choose one from the sidebar, or create a new one.
        </p>
      </div>
    </section>
  );
}
