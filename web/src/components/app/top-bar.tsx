import { Link } from 'react-router-dom';
import { LogOut, Moon, Sun, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/store/auth';
import { useLogout } from '@/features/auth/hooks';
import { useTheme } from '@/providers/theme-provider';
import { getInitials } from '@/lib/utils';

export function TopBar() {
  const user = useAuthStore((s) => s.user);
  const { resolvedTheme, setTheme } = useTheme();
  const logout = useLogout();

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background/80 px-6 backdrop-blur">
      <div className="text-sm font-medium text-muted-foreground">
        {/* breadcrumbs go here later */}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        >
          {resolvedTheme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-full ring-offset-background transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Avatar>
                {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
                <AvatarFallback>
                  {user ? getInitials(user.firstName, user.lastName) : '??'}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            {user && (
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">
                    {user.firstName} {user.lastName}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </DropdownMenuLabel>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile">
                <User className="size-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => logout.mutate()}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
