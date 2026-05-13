import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { ApiError } from '@/api/client';
import { useCreateTeam } from './queries';

const schema = z.object({
  name: z.string().min(1, 'Required').max(100),
  description: z.string().max(500).optional(),
});

type Values = z.infer<typeof schema>;

export function CreateTeamDialog() {
  const [open, setOpen] = useState(false);
  const create = useCreateTeam();
  const navigate = useNavigate();

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
      .then((team) => {
        setOpen(false);
        reset();
        toast.success(`Created "${team.name}"`);
        navigate(`/teams/${team.id}`);
      })
      .catch((err) => {
        if (err instanceof ApiError) {
          err.problem.errors?.forEach((fe) =>
            setError(fe.field as keyof Values, { message: fe.message }),
          );
        }
        toast.error(err instanceof ApiError ? err.problem.detail ?? err.problem.title : 'Failed');
      });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          New team
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a team</DialogTitle>
          <DialogDescription>
            Teams are workspaces for tasks, chat, and calls. You'll be the owner.
          </DialogDescription>
        </DialogHeader>

        <form
          id="create-team-form"
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" autoFocus {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              Description <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea id="description" rows={3} {...register('description')} />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form="create-team-form" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Create team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
