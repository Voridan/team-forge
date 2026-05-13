import { NavLink } from 'react-router-dom';
import { Sparkles, Users, LayoutDashboard, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/teams', label: 'Teams', icon: Users },
  { to: '/profile', label: 'Profile', icon: Settings },
] as const;

export function Sidebar() {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-card/30">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="size-4" />
        </div>
        <span className="text-sm font-semibold tracking-tight">TeamForge</span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
              )
            }
          >
            <Icon className="size-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
