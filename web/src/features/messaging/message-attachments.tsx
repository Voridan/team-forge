import { toast } from 'sonner';
import { attachmentsApi } from '@/api/attachments';
import { ApiError } from '@/api/client';
import type { Attachment } from '@/api/types';
import { AttachmentChip } from './attachment-chip';

interface MessageAttachmentsProps {
  teamId: string;
  attachments: Attachment[];
}

export function MessageAttachments({ teamId, attachments }: MessageAttachmentsProps) {
  if (attachments.length === 0) return null;

  const onClick = async (attachmentId: string) => {
    try {
      const { downloadUrl } = await attachmentsApi.download(teamId, attachmentId);
      // open in a new tab; the URL is short-lived and signed
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.problem.detail ?? err.problem.title
          : 'Could not get download link';
      toast.error(msg);
    }
  };

  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {attachments.map((a) => (
        <AttachmentChip
          key={a.id}
          filename={a.filename}
          sizeBytes={a.sizeBytes}
          mimeType={a.mimeType}
          state="ready"
          onClick={() => onClick(a.id)}
        />
      ))}
    </div>
  );
}
