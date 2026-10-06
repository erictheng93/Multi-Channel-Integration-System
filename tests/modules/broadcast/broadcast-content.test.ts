import { describe, expect, it } from 'vitest';
import {
  assertBroadcastAttachments,
  buildBroadcastLineMessages,
  type AttachmentCandidate,
} from '@/modules/broadcast/services/broadcast-content';

const MB = 1024 * 1024;

function row(id: string, overrides: Partial<AttachmentCandidate> = {}): AttachmentCandidate {
  return { id, mimeType: 'image/jpeg', fileSize: 500 * 1024, uploadedBy: 'agent-1', messageId: null, ...overrides };
}

const pair = (n: number) => ({ attachmentId: `img-${n}`, previewAttachmentId: `prev-${n}` });
const rowsFor = (...ns: number[]) => ns.flatMap((n) => [row(`img-${n}`, { fileSize: 8 * MB }), row(`prev-${n}`)]);

describe('assertBroadcastAttachments', () => {
  it('accepts zero to four owned, unattached images', () => {
    expect(() => assertBroadcastAttachments([], [], 'agent-1')).not.toThrow();
    expect(() => assertBroadcastAttachments([1, 2, 3, 4].map(pair), rowsFor(1, 2, 3, 4), 'agent-1')).not.toThrow();
  });

  it('rejects a fifth image', () => {
    expect(() => assertBroadcastAttachments([1, 2, 3, 4, 5].map(pair), rowsFor(1, 2, 3, 4, 5), 'agent-1'))
      .toThrow(/At most 4 images/);
  });

  it('rejects duplicate ids inside one broadcast', () => {
    const dup = [pair(1), { attachmentId: 'img-1', previewAttachmentId: 'prev-2' }];
    expect(() => assertBroadcastAttachments(dup, rowsFor(1, 2), 'agent-1')).toThrow(/unique/);
  });

  it('rejects missing rows', () => {
    expect(() => assertBroadcastAttachments([pair(1)], [row('img-1')], 'agent-1')).toThrow(/preview not found/);
  });

  it('rejects uploads owned by someone else', () => {
    const rows = [row('img-1', { uploadedBy: 'agent-2' }), row('prev-1')];
    expect(() => assertBroadcastAttachments([pair(1)], rows, 'agent-1')).toThrow(/not uploaded by you/);
  });

  it('rejects uploads already attached to a message', () => {
    const rows = [row('img-1', { messageId: 'msg-9' }), row('prev-1')];
    expect(() => assertBroadcastAttachments([pair(1)], rows, 'agent-1')).toThrow(/already attached/);
  });

  it('rejects non JPEG/PNG types', () => {
    const rows = [row('img-1', { mimeType: 'image/gif' }), row('prev-1')];
    expect(() => assertBroadcastAttachments([pair(1)], rows, 'agent-1')).toThrow(/JPEG or PNG/);
  });

  it('enforces 10MB original and 1MB preview limits', () => {
    expect(() => assertBroadcastAttachments([pair(1)], [row('img-1', { fileSize: 10 * MB + 1 }), row('prev-1')], 'agent-1'))
      .toThrow(/image exceeds/);
    expect(() => assertBroadcastAttachments([pair(1)], [row('img-1'), row('prev-1', { fileSize: MB + 1 })], 'agent-1'))
      .toThrow(/preview exceeds/);
  });
});

describe('buildBroadcastLineMessages', () => {
  const images = [
    { url: 'https://x/a.jpg', previewUrl: 'https://x/a-p.jpg' },
    { url: 'https://x/b.png', previewUrl: 'https://x/b-p.jpg' },
  ];

  it('puts text first, then images in order with their previews', () => {
    expect(buildBroadcastLineMessages('Hello', images)).toEqual([
      { type: 'text', text: 'Hello' },
      { type: 'image', originalContentUrl: 'https://x/a.jpg', previewImageUrl: 'https://x/a-p.jpg' },
      { type: 'image', originalContentUrl: 'https://x/b.png', previewImageUrl: 'https://x/b-p.jpg' },
    ]);
  });

  it('omits the text message for image-only broadcasts', () => {
    expect(buildBroadcastLineMessages('', images).map((m) => m.type)).toEqual(['image', 'image']);
  });

  it('returns a single text message for text-only broadcasts', () => {
    expect(buildBroadcastLineMessages('Hi', [])).toEqual([{ type: 'text', text: 'Hi' }]);
  });
});
