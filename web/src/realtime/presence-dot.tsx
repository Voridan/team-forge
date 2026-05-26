import { usePresenceStore } from './presence-store';
import { cn } from '@/lib/utils';

interface PresenceDotProps {
  userId: string | null | undefined;
  className?: string;
  /** Tailwind ring color around the dot — defaults to background so it hugs the avatar */
  ringClassName?: string;
}

/**
 * Tiny status indicator anchored to the bottom-right of an avatar. Hidden when
 * the user is offline so we don't draw a dot in three different colors.
 */
export function PresenceDot({
  userId,
  className,
  ringClassName = 'ring-background',
}: PresenceDotProps) {
  const isOnline = usePresenceStore((s) => (userId ? s.isOnline(userId) : false));

  if (!isOnline) return null;

  return (
    <span
      aria-label="Online"
      title="Online"
      className={cn(
        'absolute bottom-0 right-0 size-2 rounded-full bg-emerald-500 ring-2',
        ringClassName,
        className,
      )}
    />
  );
}
