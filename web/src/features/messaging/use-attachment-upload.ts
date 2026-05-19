import { useCallback, useRef, useState } from 'react';
import { attachmentsApi } from '@/api/attachments';
import { ApiError } from '@/api/client';

const APPLICATION_OCTET_STREAM = 'application/octet-stream';

export interface PendingAttachment {
  id: string;          // local UI id; equals the server attachmentId once presigned
  file: File;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  status: 'queued' | 'uploading' | 'ready' | 'failed';
  error?: string;
  attachmentId?: string; // set once presigned + uploaded
}

interface AttachmentUploadHook {
  pending: PendingAttachment[];
  enqueue: (files: File[]) => void;
  remove: (id: string) => void;
  reset: () => void;
  /** Wait until every queued attachment has finished uploading (or failed). */
  waitForReady: () => Promise<{ attachmentIds: string[]; hasFailures: boolean }>;
}

/**
 * Manages the presign → PUT to S3/MinIO → confirm cycle for files chosen
 * in a message composer. Designed to run concurrently — multiple files
 * upload in parallel.
 */
export function useAttachmentUpload(teamId: string): AttachmentUploadHook {
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  // Promises keyed by local id, so waitForReady() can resolve when each finishes.
  const promises = useRef<Map<string, Promise<void>>>(new Map());

  const update = (id: string, patch: Partial<PendingAttachment>) => {
    setPending((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const uploadOne = useCallback(
    async (local: PendingAttachment) => {
      try {
        update(local.id, { status: 'uploading' });

        const { attachmentId, uploadUrl } = await attachmentsApi.presign(teamId, {
          filename: local.filename,
          mimeType: local.mimeType,
          sizeBytes: local.sizeBytes,
        });

        const putResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': local.mimeType },
          body: local.file,
        });
        if (!putResponse.ok) {
          throw new Error(`Upload failed with status ${putResponse.status}`);
        }

        await attachmentsApi.confirm(teamId, attachmentId);

        update(local.id, { status: 'ready', attachmentId });
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.problem.detail ?? err.problem.title
            : err instanceof Error
              ? err.message
              : 'Upload failed';
        update(local.id, { status: 'failed', error: message });
      }
    },
    [teamId],
  );

  const enqueue = useCallback(
    (files: File[]) => {
      const additions: PendingAttachment[] = files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        filename: file.name,
        sizeBytes: file.size,
        mimeType: file.type || APPLICATION_OCTET_STREAM,
        status: 'queued',
      }));
      setPending((prev) => [...prev, ...additions]);
      for (const item of additions) {
        promises.current.set(item.id, uploadOne(item));
      }
    },
    [uploadOne],
  );

  const remove = useCallback((id: string) => {
    setPending((prev) => prev.filter((p) => p.id !== id));
    promises.current.delete(id);
  }, []);

  const reset = useCallback(() => {
    setPending([]);
    promises.current.clear();
  }, []);

  const waitForReady = useCallback(async () => {
    await Promise.all(Array.from(promises.current.values()));
    // Read latest snapshot via React's batched updates — by the time
    // we return, all uploads have either resolved or errored.
    return new Promise<{ attachmentIds: string[]; hasFailures: boolean }>((resolve) => {
      // Defer one tick to ensure setState calls have flushed.
      setTimeout(() => {
        setPending((current) => {
          const attachmentIds = current
            .filter((p) => p.status === 'ready' && p.attachmentId)
            .map((p) => p.attachmentId as string);
          const hasFailures = current.some((p) => p.status === 'failed');
          resolve({ attachmentIds, hasFailures });
          return current;
        });
      }, 0);
    });
  }, []);

  return { pending, enqueue, remove, reset, waitForReady };
}
