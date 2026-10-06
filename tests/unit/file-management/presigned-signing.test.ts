import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { expect, it } from 'vitest'

it('signs a direct R2 upload with the installed S3 client and presigner offline', async () => {
  const client = new S3Client({
    region: 'auto',
    endpoint: 'https://test-account.r2.cloudflarestorage.com',
    credentials: { accessKeyId: 'test-access-key', secretAccessKey: 'test-secret-key' },
    requestHandler: {
      handle: async () => {
        throw new Error('Presigning must not send a network request')
      },
    },
  })
  try {
    const url = new URL(
      await getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: 'mcis-files',
          Key: 'uploads/example file.pdf',
          ContentType: 'application/pdf',
          ContentLength: 123,
          Metadata: { 'original-filename': 'example_file.pdf' },
        }),
        {
          expiresIn: 900,
          signingDate: new Date('2026-10-06T00:00:00Z'),
        }
      )
    )

    expect(url.protocol).toBe('https:')
    expect(url.hostname).toBe('mcis-files.test-account.r2.cloudflarestorage.com')
    expect(url.pathname).toBe('/uploads/example%20file.pdf')
    expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256')
    expect(url.searchParams.get('X-Amz-Credential')).toBe(
      'test-access-key/20261006/auto/s3/aws4_request'
    )
    expect(url.searchParams.get('X-Amz-Date')).toBe('20261006T000000Z')
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900')
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('content-length;host')
    expect(url.searchParams.get('x-amz-meta-original-filename')).toBe('example_file.pdf')
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[a-f0-9]{64}$/)
  } finally {
    client.destroy()
  }
})
