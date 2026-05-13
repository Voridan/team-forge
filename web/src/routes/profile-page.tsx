import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/api/client';
import { useMeQuery, useUpdateMe } from '@/features/users/queries';
import { getInitials } from '@/lib/utils';

const schema = z.object({
  firstName: z.string().min(1, 'Required').max(100),
  lastName: z.string().min(1, 'Required').max(100),
  avatarUrl: z
    .string()
    .url('Must be a valid URL')
    .max(500)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  timezone: z.string().max(50).optional(),
});

type Values = z.infer<typeof schema>;

export function ProfilePage() {
  const { data: me, isLoading } = useMeQuery();
  const updateMe = useUpdateMe();

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    values: me
      ? {
          firstName: me.firstName,
          lastName: me.lastName,
          avatarUrl: me.avatarUrl ?? undefined,
          timezone: undefined,
        }
      : undefined,
  });

  const onSubmit = (values: Values) =>
    updateMe
      .mutateAsync(values)
      .then((user) => {
        reset({
          firstName: user.firstName,
          lastName: user.lastName,
          avatarUrl: user.avatarUrl ?? undefined,
          timezone: undefined,
        });
        toast.success('Profile updated');
      })
      .catch((err) => {
        if (err instanceof ApiError) {
          err.problem.errors?.forEach((fe) =>
            setError(fe.field as keyof Values, { message: fe.message }),
          );
          if (!err.problem.errors?.length) {
            toast.error(err.problem.detail ?? err.problem.title);
          }
        } else {
          toast.error('Could not save changes');
        }
      });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Manage your personal information.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>How others see you across TeamForge.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading || !me ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-2/3" />
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <div className="flex items-center gap-4">
                <Avatar className="size-14">
                  {me.avatarUrl && <AvatarImage src={me.avatarUrl} alt="" />}
                  <AvatarFallback className="text-base">
                    {getInitials(me.firstName, me.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-0.5">
                  <p className="font-medium">
                    {me.firstName} {me.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">{me.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First name</Label>
                  <Input id="firstName" {...register('firstName')} />
                  {errors.firstName && (
                    <p className="text-xs text-destructive">{errors.firstName.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input id="lastName" {...register('lastName')} />
                  {errors.lastName && (
                    <p className="text-xs text-destructive">{errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="avatarUrl">Avatar URL</Label>
                <Input
                  id="avatarUrl"
                  type="url"
                  placeholder="https://…"
                  {...register('avatarUrl')}
                />
                {errors.avatarUrl && (
                  <p className="text-xs text-destructive">{errors.avatarUrl.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input id="timezone" placeholder="Europe/Kyiv" {...register('timezone')} />
                <p className="text-xs text-muted-foreground">
                  IANA timezone name. Used for scheduling features later.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="submit" disabled={!isDirty || isSubmitting}>
                  {isSubmitting && <Loader2 className="animate-spin" />}
                  Save changes
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
