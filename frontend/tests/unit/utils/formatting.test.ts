/**
 * Tests for message formatting utilities
 *
 * @module tests/unit/utils/formatting
 */

import { describe, it, expect } from 'vitest'
import {
  escapeHtml,
  formatFileSize,
  getFileExtension,
  getFileTypeClass,
  isImageFile
} from '@/utils/message/formatting'

describe('escapeHtml', () => {
  it('should escape HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>'))
      .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
  })

  it('should escape ampersand', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry')
  })

  it('should escape quotes', () => {
    expect(escapeHtml('"Hello"')).toBe('&quot;Hello&quot;')
  })

  it('should handle empty string', () => {
    expect(escapeHtml('')).toBe('')
  })

  it('should handle plain text without special chars', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World')
  })
})

describe('formatFileSize', () => {
  it('should format 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 B')
  })

  it('should format bytes', () => {
    expect(formatFileSize(500)).toBe('500 B')
  })

  it('should format kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1 KB')
    expect(formatFileSize(1536)).toBe('1.5 KB')
  })

  it('should format megabytes', () => {
    expect(formatFileSize(1048576)).toBe('1 MB')
    expect(formatFileSize(1572864)).toBe('1.5 MB')
  })

  it('should format gigabytes', () => {
    expect(formatFileSize(1073741824)).toBe('1 GB')
    expect(formatFileSize(1610612736)).toBe('1.5 GB')
  })

  it('should round to 2 decimal places', () => {
    expect(formatFileSize(1536000)).toBe('1.46 MB')
  })

  it('should handle large file sizes', () => {
    expect(formatFileSize(5368709120)).toBe('5 GB')
  })
})

describe('getFileExtension', () => {
  it('should extract file extension', () => {
    expect(getFileExtension('document.pdf')).toBe('PDF')
    expect(getFileExtension('image.jpg')).toBe('JPG')
    expect(getFileExtension('archive.tar.gz')).toBe('GZ')
  })

  it('should return empty string for files without extension', () => {
    expect(getFileExtension('README')).toBe('')
    expect(getFileExtension('no-extension')).toBe('')
  })

  it('should handle empty string', () => {
    expect(getFileExtension('')).toBe('')
  })

  it('should handle single dot', () => {
    expect(getFileExtension('.')).toBe('')
  })

  it('should return uppercase extension', () => {
    expect(getFileExtension('file.txt')).toBe('TXT')
    expect(getFileExtension('file.TXT')).toBe('TXT')
  })
})

describe('getFileTypeClass', () => {
  it('should return specific class for PDF', () => {
    expect(getFileTypeClass('document.pdf')).toBe('pdf')
  })

  it('should return image class for JPG/JPEG', () => {
    expect(getFileTypeClass('photo.jpg')).toBe('image')
    expect(getFileTypeClass('photo.jpeg')).toBe('image')
  })

  it('should return text class for TXT', () => {
    expect(getFileTypeClass('readme.txt')).toBe('text')
  })

  it('should return file-type-image for image files', () => {
    expect(getFileTypeClass('image.png')).toBe('file-type-image')
    expect(getFileTypeClass('image.gif')).toBe('file-type-image')
    expect(getFileTypeClass('image.webp')).toBe('file-type-image')
  })

  it('should return file-type-document for document files', () => {
    expect(getFileTypeClass('document.doc')).toBe('file-type-document')
    expect(getFileTypeClass('document.docx')).toBe('file-type-document')
  })

  it('should return file-type-code for code files', () => {
    expect(getFileTypeClass('script.js')).toBe('file-type-code')
    expect(getFileTypeClass('script.ts')).toBe('file-type-code')
    expect(getFileTypeClass('style.css')).toBe('file-type-code')
  })

  it('should return file-type-archive for archive files', () => {
    expect(getFileTypeClass('archive.zip')).toBe('file-type-archive')
    expect(getFileTypeClass('archive.rar')).toBe('file-type-archive')
    expect(getFileTypeClass('archive.tar')).toBe('file-type-archive')
  })

  it('should return default class for unknown types', () => {
    expect(getFileTypeClass('unknown.xyz')).toBe('file-type-document')
  })

  it('should handle uppercase extensions', () => {
    expect(getFileTypeClass('IMAGE.PNG')).toBe('file-type-image')
  })
})

describe('isImageFile', () => {
  it('should detect image by MIME type', () => {
    expect(isImageFile({ mimeType: 'image/jpeg' })).toBe(true)
    expect(isImageFile({ mimeType: 'image/png' })).toBe(true)
    expect(isImageFile({ mimeType: 'image/gif' })).toBe(true)
  })

  it('should detect non-image by MIME type', () => {
    expect(isImageFile({ mimeType: 'application/pdf' })).toBe(false)
    expect(isImageFile({ mimeType: 'text/plain' })).toBe(false)
  })

  it('should detect image by filename extension', () => {
    expect(isImageFile({ filename: 'photo.jpg' })).toBe(true)
    expect(isImageFile({ filename: 'photo.jpeg' })).toBe(true)
    expect(isImageFile({ filename: 'photo.png' })).toBe(true)
    expect(isImageFile({ filename: 'photo.gif' })).toBe(true)
    expect(isImageFile({ filename: 'photo.webp' })).toBe(true)
  })

  it('should detect non-image by filename extension', () => {
    expect(isImageFile({ filename: 'document.pdf' })).toBe(false)
    expect(isImageFile({ filename: 'readme.txt' })).toBe(false)
  })

  it('should prioritize MIME type over filename', () => {
    // MIME type says image, filename says pdf - trust MIME type
    expect(isImageFile({ mimeType: 'image/jpeg', filename: 'fake.pdf' })).toBe(true)

    // MIME type says pdf, filename says jpg - trust MIME type
    expect(isImageFile({ mimeType: 'application/pdf', filename: 'fake.jpg' })).toBe(false)
  })

  it('should return false for empty object', () => {
    expect(isImageFile({})).toBe(false)
  })

  it('should handle uppercase extensions', () => {
    expect(isImageFile({ filename: 'PHOTO.JPG' })).toBe(true)
  })

  it('should handle case-insensitive MIME type', () => {
    expect(isImageFile({ mimeType: 'Image/JPEG' })).toBe(true)
  })
})
