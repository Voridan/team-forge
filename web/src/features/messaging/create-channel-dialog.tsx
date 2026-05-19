import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { ApiError } from '@/api/client';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateChannel } from './queries';

const schema = z.object({
  name: z
    .string()
    .min(1, 'Required')
    .max(80)
    .regex(/^[a-z0-9][a-z0-9-_]*$/i, 'Letters, digits, "-" or "_" only'),
  description: z.string().max(500).optional(),
});

type Values = z.infer<typeof schema>;

interface Props {
  teamId: string;
  onCreated?: (channelId: string) => void;
}

export function CreateChannelDialog({ teamId, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const create = useCreateChannel(teamId);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  });

  const onSubmit = (values: Values) =>
    create
      .mutateAsync(values)
      .then((channel) => {
        toast.success(`Created #${channel.name}`);
        reset();
        setOpen(false);
        onCreated?.(channel.id);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 409) {
          setError('name', { message: 'A channel with this name already exists' });
          return;
        }
        toast.error(
          err instanceof ApiError ? err.problem.detail ?? err.problem.title : 'Failed',
        );
      });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7" aria-label="Create channel">
          <Plus className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a channel</DialogTitle>
          <DialogDescription>
            Channels keep conversation focused. Any team member can post; admins can rename or archive.
          </DialogDescription>
        </DialogHeader>

        <form
          id="create-channel-form"
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="channel-name">Name</Label>
            <div className="flex items-center rounded-md border bg-background pl-2.5 shadow-sm transition-colors focus-within:border-foreground/30 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 focus-within:ring-offset-background">
              <span className="select-none text-sm text-muted-foreground">#</span>
              <Input
                id="channel-name"
                placeholder="general"
                autoFocus
                className="border-0 bg-transparent shadow-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                {...register('name')}
              />
            </div>
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="channel-description">
              Description <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="channel-description"
              rows={2}
              placeholder="What's this channel about?"
              {...register('description')}
            />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>
        </form>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form="create-channel-form" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
