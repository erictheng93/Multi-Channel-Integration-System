import type { fileAttachments } from '@/db/schema';
import type { LineReplyMessage } from '@/types';
import { createImageMessage, createTextMessage } from '@/utils/line';
import { BroadcastServiceError, type BroadcastAttachmentInput } from '@modules/broadcast/types';

// LINE multicast carries at most 5 message objects: 1 text + 4 images.
export const BROADCAST_MAX_IMAGES = 4;
export const BROADCAST_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
// LINE previewImageUrl limit; larger previews render as broken images client-side.
export const BROADCAST_PREVIEW_MAX_BYTES = 1024 * 1024;
const BROADCAST_IMAGE_MIME_TYPES: readonly string[] = ['image/jpeg', 'image/png'];

export interface AttachmentCandidate {
  id: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: string | null;
  messageId: string | null;
}

export function assertBroadcastAttachments(
  attachments: BroadcastAttachmentInput[],
  rows: AttachmentCandidate[],
  actorId: string
): void {
  if (attachments.length > BROADCAST_MAX_IMAGES) {
    fail(`At most ${BROADCAST_MAX_IMAGES} images per broadcast`);
  }

  const ids = attachments.flatMap((item) => [item.attachmentId, item.previewAttachmentId]);
  if (new Set(ids).size !== ids.length) {
    fail('Attachment ids must be unique');
  }

  const byId = new Map(rows.map((candidate) => [candidate.id, candidate]));
  for (const item of attachments) {
    checkImage(byId.get(item.attachmentId), actorId, BROADCAST_IMAGE_MAX_BYTES, 'image');
    checkImage(byId.get(item.previewAttachmentId), actorId, BROADCAST_PREVIEW_MAX_BYTES, 'preview');
  }
}

export function buildBroadcastLineMessages(
  content: string,
  images: Array<{ url: string; previewUrl: string }>
): LineReplyMessage[] {
  const text = content ? [createTextMessage(content)] : [];
  return [...text, ...images.map((image) => createImageMessage(image.url, image.previewUrl))];
}

export interface BroadcastImageFile {
  filename: string;
  mimeType: string;
  fileSize: number;
  r2Key: string;
  url: string;
}

// ponytail: rows share the original r2Key; FileService.deleteFile only removes
// the R2 object once no row references it.
export function buildWriteBackAttachmentRows(
  messageId: string,
  conversationId: string,
  images: BroadcastImageFile[],
  uploadedBy: string,
  createdAt: string
): Array<typeof fileAttachments.$inferInsert> {
  return images.map((image) => ({
    id: crypto.randomUUID(),
    messageId,
    conversationId,
    filename: image.filename,
    mimeType: image.mimeType,
    fileSize: image.fileSize,
    fileUrl: image.url,
    r2Key: image.r2Key,
    uploadStatus: 'completed',
    uploadedBy,
    createdAt,
  }));
}

function checkImage(
  candidate: AttachmentCandidate | undefined,
  actorId: string,
  maxBytes: number,
  label: 'image' | 'preview'
): void {
  if (!candidate) {
    fail(`${label} not found`);
  }
  if (candidate.uploadedBy !== actorId) {
    fail(`${label} was not uploaded by you`);
  }
  if (candidate.messageId !== null) {
    fail(`${label} is already attached to a message`);
  }
  if (!BROADCAST_IMAGE_MIME_TYPES.includes(candidate.mimeType)) {
    fail(`${label} must be JPEG or PNG`);
  }
  if (candidate.fileSize > maxBytes) {
    fail(`${label} exceeds ${maxBytes} bytes`);
  }
}

function fail(message: string): never {
  throw new BroadcastServiceError('INVALID_BROADCAST_INPUT', message, 422);
}
