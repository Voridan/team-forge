import { apiFetch } from './client';
import type { Attachment, DownloadInfo, PresignedUpload } from './types';

export interface PresignPayload {
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export const attachmentsApi = {
  presign: (teamId: string, payload: PresignPayload) =>
    apiFetch<PresignedUpload>(`/teams/${teamId}/attachments/presign`, {
      method: 'POST',
      body: payload,
    }),

  confirm: (teamId: string, attachmentId: string) =>
    apiFetch<Attachment>(`/teams/${teamId}/attachments/${attachmentId}/confirm`, {
      method: 'POST',
    }),

  download: (teamId: string, attachmentId: string) =>
    apiFetch<DownloadInfo>(`/teams/${teamId}/attachments/${attachmentId}/download`),

  delete: (teamId: string, attachmentId: string) =>
    apiFetch<void>(`/teams/${teamId}/attachments/${attachmentId}`, { method: 'DELETE' }),
};
