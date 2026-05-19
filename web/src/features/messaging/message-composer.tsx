import { useRef, useState } from 'react';
import { Paperclip, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AttachmentChip } from './attachment-chip';
import { useSendMessage } from './queries';
import { useAttachmentUpload } from './use-attachment-upload';

interface MessageComposerProps {
  teamId: string;
  channelId: string;
  channelName: string;
}

export function MessageComposer({ teamId, channelId, channelName }: MessageComposerProps) {
  const [content, setContent] = useState('');
  const upload = useAttachmentUpload(teamId);
  const sendMutation = useSendMessage(teamId, channelId);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canSubmit =
    (content.trim().length > 0 || upload.pending.some((p) => p.status === 'ready')) &&
    !sendMutation.isPending &&
    !upload.pending.some((p) => p.status === 'uploading' || p.status === 'queued');

  const submit = async () => {
    if (!canSubmit) return;

    const { attachmentIds, hasFailures } = await upload.waitForReady();
    if (hasFailures) {
      toast.error('Some attachments failed to upload — remove them or retry');
      return;
    }

    sendMutation.mutate(
      {
        content: content.trim(),
        attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined,
      },
      {
        onSuccess: () => {
          setContent('');
          upload.reset();
        },
        onError: (err) => {
          const msg =
            err instanceof ApiError ? err.problem.detail ?? err.problem.title : 'Send failed';
          toast.error(msg);
        },
      },
    );
  };

  const onFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    upload.enqueue(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="border-t bg-background p-3">
      {upload.pending.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {upload.pending.map((p) => (
            <AttachmentChip
              key={p.id}
              filename={p.filename}
              sizeBytes={p.sizeBytes}
              mimeType={p.mimeType}
              state={
                p.status === 'ready'
                  ? 'ready'
                  : p.status === 'failed'
                    ? 'failed'
                    : 'uploading'
              }
              error={p.error}
              onRemove={() => upload.remove(p.id)}
            />
          ))}
        </div>
      )}

      <div
        className="flex items-end gap-1.5 rounded-xl border bg-card px-1.5 py-1.5 shadow-sm transition-colors focus-within:border-foreground/30 focus-within:ring-2 focus-within:ring-ring/40 focus-within:ring-offset-1 focus-within:ring-offset-background"
        onPaste={(e) => {
          const files = Array.from(e.clipboardData.files);
          if (files.length > 0) {
            e.preventDefault();
            upload.enqueue(files);
          }
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          if (e.dataTransfer.files.length > 0) {
            e.preventDefault();
            upload.enqueue(Array.from(e.dataTransfer.files));
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => onFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach files"
        >
          <Paperclip className="size-4" />
        </Button>

        <Textarea
          rows={1}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={`Message #${channelName}`}
          className="block min-h-8 max-h-40 flex-1 resize-none self-center border-0 bg-transparent px-1 py-[7px] text-sm leading-5 shadow-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />

        <Button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          size="icon"
          className="size-8 shrink-0"
          aria-label="Send"
        >
          {sendMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}
