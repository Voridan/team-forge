import { File, FileImage, FileText, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AttachmentChipProps {
  filename: string;
  sizeBytes: number;
  mimeType: string;
  state: 'uploading' | 'ready' | 'failed';
  error?: string;
  onRemove?: () => void;
  onClick?: () => void;
}

export function AttachmentChip({
  filename,
  sizeBytes,
  mimeType,
  state,
  error,
  onRemove,
  onClick,
}: AttachmentChipProps) {
  const Icon = pickIcon(mimeType);
  const interactive = !!onClick;

  return (
    <div
      className={cn(
        'group inline-flex max-w-xs items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-xs shadow-sm transition-colors',
        interactive && 'cursor-pointer hover:border-foreground/30',
        state === 'failed' && 'border-destructive/50 bg-destructive/5',
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (interactive && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.();
        }
      }}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      {state === 'uploading' ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <Icon
          className={cn(
            'size-4 shrink-0',
            state === 'failed' ? 'text-destructive' : 'text-muted-foreground',
          )}
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{filename}</p>
        <p
          className={cn(
            'text-[10.5px]',
            state === 'failed' ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {state === 'failed' ? (error ?? 'Upload failed') : formatSize(sizeBytes)}
        </p>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${filename}`}
          className="rounded text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function pickIcon(mimeType: string): typeof File {
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.startsWith('text/') || mimeType === 'application/pdf') return FileText;
  return File;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
