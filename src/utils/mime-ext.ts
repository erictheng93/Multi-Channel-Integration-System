// Minimal MIME -> extension map for backend code that needs to guarantee a
// downloadable filename has a valid extension. Kept intentionally small and
// aligned with frontend/src/utils/message/formatting.ts MIME_TO_EXT.

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/bmp': '.bmp',
  'image/svg+xml': '.svg',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/x-msvideo': '.avi',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/aac': '.aac',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
};

/**
 * Return a filename that is guaranteed to carry a file extension.
 *
 * If the input already ends with ".<1-8 alphanumerics>" it is returned
 * unchanged. Otherwise we derive an extension from mimeType. If we have no
 * mapping for that mimeType we return the base as-is — callers that need a
 * hard guarantee should fall back to their own default.
 */
export function ensureFilenameExtension(
  filename: string | null | undefined,
  mimeType: string | null | undefined
): string {
  const base = filename && filename.trim() ? filename.trim() : 'download';
  if (/\.[a-z0-9]{1,8}$/i.test(base)) {
    return base;
  }
  const normalized = mimeType?.toLowerCase().split(';')[0]?.trim() ?? '';
  const ext = MIME_TO_EXT[normalized] || '';
  return ext ? `${base}${ext}` : base;
}
