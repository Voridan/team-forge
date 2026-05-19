import { Hash } from 'lucide-react';
import type { Channel } from '@/api/types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { CreateChannelDialog } from './create-channel-dialog';
import { useChannelsQuery } from './queries';

interface ChannelListProps {
  teamId: string;
  activeChannelId: string | null;
  onSelect: (channelId: string) => void;
  canCreate: boolean;
}

export function ChannelList({
  teamId,
  activeChannelId,
  onSelect,
  canCreate,
}: ChannelListProps) {
  const { data: channels, isLoading } = useChannelsQuery(teamId);

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-card/30">
      <header className="flex h-10 items-center justify-between gap-2 border-b px-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Channels
        </h3>
        {canCreate && <CreateChannelDialog teamId={teamId} onCreated={onSelect} />}
      </header>

      <nav className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {isLoading && (
          <div className="space-y-1">
            <Skeleton className="h-7" />
            <Skeleton className="h-7" />
            <Skeleton className="h-7" />
          </div>
        )}
        {!isLoading && channels && channels.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            No channels yet.
            {canCreate && <span className="block mt-1">Create one with the + above.</span>}
          </p>
        )}
        {channels?.map((channel) => (
          <ChannelItem
            key={channel.id}
            channel={channel}
            isActive={channel.id === activeChannelId}
            onClick={() => onSelect(channel.id)}
          />
        ))}
      </nav>
    </aside>
  );
}

function ChannelItem({
  channel,
  isActive,
  onClick,
}: {
  channel: Channel;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors',
        isActive
          ? 'bg-secondary font-medium text-foreground'
          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
      )}
    >
      <Hash className="size-3.5 shrink-0" />
      <span className="truncate">{channel.name}</span>
    </button>
  );
}
