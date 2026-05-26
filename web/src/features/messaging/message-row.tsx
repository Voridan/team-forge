import { useState } from 'react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { MoreHorizontal, Pencil, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import type { Message, TeamMemberPublic } from '@/api/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { cn, getInitials } from '@/lib/utils';
import { PresenceDot } from '@/realtime/presence-dot';
import { useDeleteMessage, useEditMessage } from './queries';
import { MessageAttachments } from './message-attachments';

interface MessageRowProps {
  teamId: string;
  channelId: string;
  message: Message;
  member: TeamMemberPublic | null;
  isAuthor: boolean;
  canDeleteAsAdmin: boolean;
  showHeader: boolean;
}

export function MessageRow({
  teamId,
  channelId,
  message,
  member,
  isAuthor,
  canDeleteAsAdmin,
  showHeader,
}: MessageRowProps) {
  const editMutation = useEditMessage(teamId, channelId);
  const deleteMutation = useDeleteMessage(teamId, channelId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  const onSubmitEdit = () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === message.content) {
      setEditing(false);
      return;
    }
    editMutation.mutate(
      { messageId: message.id, payload: { content: trimmed } },
      {
        onSuccess: () => setEditing(false),
        onError: (err) =>
          toast.error(
            err instanceof ApiError ? err.problem.detail ?? err.problem.title : 'Edit failed',
          ),
      },
    );
  };

  const onDelete = () => {
    if (!confirm('Delete this message?')) return;
    deleteMutation.mutate(message.id, {
      onError: (err) =>
        toast.error(
          err instanceof ApiError ? err.problem.detail ?? err.problem.title : 'Delete failed',
        ),
    });
  };

  return (
    <div
      className={cn(
        'group relative flex gap-3 px-4 py-1 transition-colors hover:bg-muted/30',
        showHeader && 'mt-3 pt-2',
      )}
    >
      <div className="w-9 shrink-0">
        {showHeader ? (
          <div className="relative">
            <Avatar className="size-9">
              {member?.avatarUrl && <AvatarImage src={member.avatarUrl} alt="" />}
              <AvatarFallback className="text-xs">
                {member ? getInitials(member.firstName, member.lastName) : '??'}
              </AvatarFallback>
            </Avatar>
            <PresenceDot userId={member?.userId} />
          </div>
        ) : (
          <span
            className="block pt-1 text-center text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100"
            title={format(parseISO(message.createdAt), 'MMM d, HH:mm')}
          >
            {format(parseISO(message.createdAt), 'HH:mm')}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {showHeader && (
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">
              {member ? `${member.firstName} ${member.lastName}` : 'Former member'}
            </span>
            <span
              className="text-xs text-muted-foreground"
              title={format(parseISO(message.createdAt), 'MMM d, yyyy HH:mm')}
            >
              {formatDistanceToNow(parseISO(message.createdAt), { addSuffix: true })}
            </span>
          </div>
        )}

        {editing ? (
          <div className="mt-1 space-y-1">
            <Textarea
              autoFocus
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSubmitEdit();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setEditing(false);
                  setDraft(message.content);
                }
              }}
              className="text-sm"
            />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                <kbd className="rounded bg-secondary px-1 font-mono">↵</kbd> save{' '}
                <kbd className="rounded bg-secondary px-1 font-mono">esc</kbd> cancel
              </span>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {message.content}
            {message.editedAt && (
              <span className="ml-1 text-[10.5px] text-muted-foreground">(edited)</span>
            )}
          </p>
        )}

        <MessageAttachments teamId={teamId} attachments={message.attachments} />
      </div>

      {(isAuthor || canDeleteAsAdmin) && !editing && (
        <div className="absolute right-3 top-1 opacity-0 transition-opacity group-hover:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7" aria-label="Message actions">
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isAuthor && (
                <DropdownMenuItem onSelect={() => setEditing(true)}>
                  <Pencil className="size-4" />
                  Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {editing && (
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setDraft(message.content);
          }}
          className="absolute right-3 top-2 rounded text-muted-foreground hover:text-foreground"
          aria-label="Cancel edit"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
