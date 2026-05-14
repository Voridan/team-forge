import { ChevronsUp, ChevronUp, Equal, ChevronDown } from 'lucide-react';
import type { TaskPriority } from '@/api/types';
import { cn } from '@/lib/utils';

const VARIANTS: Record<
  TaskPriority,
  { icon: typeof ChevronUp; label: string; classes: string }
> = {
  URGENT: {
    icon: ChevronsUp,
    label: 'Urgent',
    classes: 'bg-red-500/10 text-red-700 dark:text-red-400 ring-red-500/20',
  },
  HIGH: {
    icon: ChevronUp,
    label: 'High',
    classes: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 ring-orange-500/20',
  },
  MEDIUM: {
    icon: Equal,
    label: 'Medium',
    classes: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20',
  },
  LOW: {
    icon: ChevronDown,
    label: 'Low',
    classes: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 ring-zinc-500/20',
  },
};

interface PriorityPillProps {
  priority: TaskPriority;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

export function PriorityPill({
  priority,
  size = 'sm',
  showLabel = false,
  className,
}: PriorityPillProps) {
  const { icon: Icon, label, classes } = VARIANTS[priority];
  const sizeClasses =
    size === 'sm'
      ? 'h-5 gap-0.5 px-1.5 text-[10.5px]'
      : 'h-6 gap-1 px-2 text-xs';
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md font-medium ring-1 ring-inset',
        sizeClasses,
        classes,
        className,
      )}
      aria-label={`Priority: ${label}`}
    >
      <Icon className={size === 'sm' ? 'size-3' : 'size-3.5'} />
      {showLabel && <span className="leading-none">{label}</span>}
    </span>
  );
}
