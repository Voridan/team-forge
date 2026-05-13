import { Outlet, Navigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useAuthStore } from '@/store/auth';

export function AuthLayout() {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (accessToken) return <Navigate to="/" replace />;

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <div className="flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </div>
            <span className="text-lg font-semibold tracking-tight">TeamForge</span>
          </div>
          <Outlet />
        </div>
      </div>

      <div className="hidden bg-gradient-to-br from-primary/10 via-primary/5 to-background lg:block">
        <div className="flex h-full flex-col items-center justify-center px-12">
          <blockquote className="max-w-md text-pretty text-2xl font-medium leading-snug tracking-tight text-foreground/90">
            “Coordinate work, talk in real time, and see how your team actually moves —
            in one place.”
          </blockquote>
          <div className="mt-6 text-sm text-muted-foreground">
            Built for teams that ship.
          </div>
        </div>
      </div>
    </div>
  );
}
