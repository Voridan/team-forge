import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/api/client';
import { useRegister } from './hooks';

const schema = z.object({
  firstName: z.string().min(1, 'Required').max(100),
  lastName: z.string().min(1, 'Required').max(100),
  email: z.string().email('Enter a valid email').max(255),
  password: z.string().min(8, 'At least 8 characters').max(128),
});

type Values = z.infer<typeof schema>;

export function RegisterForm() {
  const reg = useRegister();
  const [params] = useSearchParams();
  const invitationToken = params.get('invitation') ?? undefined;
  const invitedEmail = params.get('email');

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: invitedEmail ?? '',
      password: '',
    },
  });

  const onSubmit = (values: Values) =>
    reg.mutateAsync({ ...values, invitationToken }).catch((err) => {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setError('email', { message: 'Email already in use' });
          return;
        }
        err.problem.errors?.forEach((fe) => {
          setError(fe.field as keyof Values, { message: fe.message });
        });
        if (!err.problem.errors?.length) {
          setError('root', { message: err.problem.detail ?? err.problem.title });
        }
      } else {
        setError('root', { message: 'Something went wrong. Try again.' });
      }
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {invitationToken && invitedEmail && (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
          You're creating an account for{' '}
          <span className="font-medium">{invitedEmail}</span> from a team invitation.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" autoComplete="given-name" autoFocus {...register('firstName')} />
          {errors.firstName && (
            <p className="text-xs text-destructive">{errors.firstName.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" autoComplete="family-name" {...register('lastName')} />
          {errors.lastName && (
            <p className="text-xs text-destructive">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          readOnly={!!invitedEmail}
          aria-invalid={!!errors.email}
          {...register('email')}
        />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          {...register('password')}
        />
        {errors.password ? (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        ) : (
          <p className="text-xs text-muted-foreground">At least 8 characters.</p>
        )}
      </div>

      {errors.root && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errors.root.message}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" />}
        Create account
      </Button>
    </form>
  );
}
