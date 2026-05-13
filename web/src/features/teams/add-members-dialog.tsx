import { useState, useMemo } from 'react';
import { Plus, Search, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useUserSearch } from '@/features/users/queries';
import { ApiError } from '@/api/client';
import { getInitials } from '@/lib/utils';
import type { PublicUser, TeamMemberPublic } from '@/api/types';
import { useAddMembers } from './queries';

interface Props {
  teamId: string;
  existingMembers: TeamMemberPublic[];
}

export function AddMembersDialog({ teamId, existingMembers }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<PublicUser[]>([]);

  const existingIds = useMemo(
    () => new Set(existingMembers.map((m) => m.userId)),
    [existingMembers],
  );

  const { data: results, isLoading } = useUserSearch(query.trim());
  const filteredResults = useMemo(
    () =>
      (results ?? []).filter(
        (u) => !existingIds.has(u.id) && !picked.some((p) => p.id === u.id),
      ),
    [results, existingIds, picked],
  );

  const addMembers = useAddMembers(teamId);

  const reset = () => {
    setQuery('');
    setPicked([]);
  };

  const onSubmit = () => {
    if (picked.length === 0) return;
    addMembers
      .mutateAsync({ userIds: picked.map((u) => u.id), role: 'MEMBER' })
      .then(() => {
        toast.success(`Added ${picked.length} ${picked.length === 1 ? 'member' : 'members'}`);
        setOpen(false);
        reset();
      })
      .catch((err) => {
        const msg = err instanceof ApiError ? err.problem.detail ?? err.problem.title : 'Failed';
        toast.error(msg);
      });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          Add members
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add members</DialogTitle>
          <DialogDescription>
            Search by name or email. New members join with the Member role.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {picked.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {picked.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => setPicked(picked.filter((p) => p.id !== user.id))}
                  className="group inline-flex items-center gap-1.5 rounded-full bg-secondary py-1 pl-1 pr-2 text-xs font-medium hover:bg-secondary/80"
                >
                  <Avatar className="size-5">
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
                    <AvatarFallback className="text-[10px]">
                      {getInitials(user.firstName, user.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  {user.firstName} {user.lastName}
                  <X className="size-3 text-muted-foreground group-hover:text-foreground" />
                </button>
              ))}
            </div>
          )}

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search users…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="max-h-72 min-h-32 overflow-y-auto rounded-md border">
            {query.trim().length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Type to search.
              </p>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="sm" />
              </div>
            ) : filteredResults.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No users found.
              </p>
            ) : (
              <ul className="divide-y">
                {filteredResults.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => setPicked([...picked, user])}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent"
                    >
                      <Avatar className="size-8">
                        {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
                        <AvatarFallback>
                          {getInitials(user.firstName, user.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={picked.length === 0 || addMembers.isPending}
          >
            {addMembers.isPending && <Loader2 className="animate-spin" />}
            Add {picked.length > 0 && `(${picked.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
