import { describe, it, expect } from 'vitest'
import {
  escapeHtml,
  formatFileSize,
  getFileExtension,
  getFileTypeClass,
  isImageFile
} from '@/utils/message/formatting'

describe('Message Formatting Utilities', () => {
  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(escapeHtml('<script>alert("xss")</script>'))
        .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
    })

    it('should escape ampersands', () => {
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry')
    })

    it('should escape quotes', () => {
      expect(escapeHtml('He said "Hello"')).toBe('He said &quot;Hello&quot;')
    })

    it('should handle empty strings', () => {
      expect(escapeHtml('')).toBe('')
    })

    it('should handle strings without special characters', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World')
    })

    it('should escape multiple special characters', () => {
      expect(escapeHtml('<div class="test">A & B</div>'))
        .toBe('&lt;div class=&quot;test&quot;&gt;A &amp; B&lt;/div&gt;')
    })

    it('should handle Unicode characters', () => {
      expect(escapeHtml('Hello 你好 ')).toBe('Hello 你好 ')
    })
  })

  describe('formatFileSize', () => {
    it('should format 0 bytes', () => {
      expect(formatFileSize(0)).toBe('0 B')
    })

    it('should format bytes', () => {
      expect(formatFileSize(100)).toBe('100 B')
      expect(formatFileSize(1023)).toBe('1023 B')
    })

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB')
      expect(formatFileSize(1536)).toBe('1.5 KB')
      expect(formatFileSize(2048)).toBe('2 KB')
    })

    it('should format megabytes', () => {
      expect(formatFileSize(1048576)).toBe('1 MB')
      expect(formatFileSize(1572864)).toBe('1.5 MB')
      expect(formatFileSize(10485760)).toBe('10 MB')
    })

    it('should format gigabytes', () => {
      expect(formatFileSize(1073741824)).toBe('1 GB')
      expect(formatFileSize(1610612736)).toBe('1.5 GB')
    })

    it('should handle decimal precision', () => {
      expect(formatFileSize(1536000)).toBe('1.46 MB')
      expect(formatFileSize(2621440)).toBe('2.5 MB')
    })

    it('should handle very large files', () => {
      const result = formatFileSize(5368709120) // 5 GB
      expect(result).toBe('5 GB')
    })
  })

  describe('getFileExtension', () => {
    it('should extract extension from filename', () => {
      expect(getFileExtension('document.pdf')).toBe('PDF')
      expect(getFileExtension('image.jpg')).toBe('JPG')
      expect(getFileExtension('video.mp4')).toBe('MP4')
    })

    it('should handle multiple dots in filename', () => {
      expect(getFileExtension('archive.tar.gz')).toBe('GZ')
      expect(getFileExtension('backup.2024.01.27.zip')).toBe('ZIP')
    })

    it('should return empty string for files without extension', () => {
      expect(getFileExtension('README')).toBe('')
      expect(getFileExtension('makefile')).toBe('')
    })

    it('should handle empty filename', () => {
      expect(getFileExtension('')).toBe('')
    })

    it('should return uppercase extension', () => {
      expect(getFileExtension('file.txt')).toBe('TXT')
      expect(getFileExtension('FILE.TXT')).toBe('TXT')
      expect(getFileExtension('File.TxT')).toBe('TXT')
    })

    it('should handle hidden files with extension', () => {
      expect(getFileExtension('.gitignore')).toBe('GITIGNORE')
      expect(getFileExtension('.env.local')).toBe('LOCAL')
    })

    it('should handle filenames with trailing dot', () => {
      expect(getFileExtension('file.')).toBe('')
    })
  })

  describe('getFileTypeClass', () => {
    describe('specific extension mapping', () => {
      it('should return "pdf" for PDF files', () => {
        expect(getFileTypeClass('document.pdf')).toBe('pdf')
        expect(getFileTypeClass('report.PDF')).toBe('pdf')
      })

      it('should return "image" for JPG/JPEG files', () => {
        expect(getFileTypeClass('photo.jpg')).toBe('image')
        expect(getFileTypeClass('photo.jpeg')).toBe('image')
        expect(getFileTypeClass('PHOTO.JPG')).toBe('image')
      })

      it('should return "text" for TXT files', () => {
        expect(getFileTypeClass('readme.txt')).toBe('text')
        expect(getFileTypeClass('notes.TXT')).toBe('text')
      })
    })

    describe('category-based mapping', () => {
      it('should return "file-type-image" for image files', () => {
        expect(getFileTypeClass('photo.png')).toBe('file-type-image')
        expect(getFileTypeClass('icon.gif')).toBe('file-type-image')
        expect(getFileTypeClass('banner.webp')).toBe('file-type-image')
        expect(getFileTypeClass('logo.svg')).toBe('file-type-image')
      })

      it('should return "file-type-document" for document files', () => {
        expect(getFileTypeClass('report.doc')).toBe('file-type-document')
        expect(getFileTypeClass('presentation.docx')).toBe('file-type-document')
        expect(getFileTypeClass('notes.rtf')).toBe('file-type-document')
      })

      it('should return "file-type-code" for code files', () => {
        expect(getFileTypeClass('script.js')).toBe('file-type-code')
        expect(getFileTypeClass('component.ts')).toBe('file-type-code')
        expect(getFileTypeClass('style.css')).toBe('file-type-code')
        expect(getFileTypeClass('index.html')).toBe('file-type-code')
        expect(getFileTypeClass('data.json')).toBe('file-type-code')
        expect(getFileTypeClass('config.xml')).toBe('file-type-code')
      })

      it('should return "file-type-archive" for archive files', () => {
        expect(getFileTypeClass('backup.zip')).toBe('file-type-archive')
        expect(getFileTypeClass('package.rar')).toBe('file-type-archive')
        expect(getFileTypeClass('compressed.7z')).toBe('file-type-archive')
        expect(getFileTypeClass('archive.tar')).toBe('file-type-archive')
        expect(getFileTypeClass('compressed.gz')).toBe('file-type-archive')
      })

      it('should return "file-type-document" for unknown extensions', () => {
        expect(getFileTypeClass('file.xyz')).toBe('file-type-document')
        expect(getFileTypeClass('unknown.abc')).toBe('file-type-document')
      })
    })

    describe('edge cases', () => {
      it('should handle files without extension', () => {
        expect(getFileTypeClass('README')).toBe('file-type-document')
      })

      it('should handle empty filename', () => {
        expect(getFileTypeClass('')).toBe('file-type-document')
      })

      it('should handle case insensitivity', () => {
        expect(getFileTypeClass('FILE.PNG')).toBe('file-type-image')
        expect(getFileTypeClass('FILE.Png')).toBe('file-type-image')
      })
    })
  })

  describe('isImageFile', () => {
    describe('MIME type detection', () => {
      it('should detect image MIME types', () => {
        expect(isImageFile({ mimeType: 'image/jpeg' })).toBe(true)
        expect(isImageFile({ mimeType: 'image/png' })).toBe(true)
        expect(isImageFile({ mimeType: 'image/gif' })).toBe(true)
        expect(isImageFile({ mimeType: 'image/webp' })).toBe(true)
        expect(isImageFile({ mimeType: 'image/svg+xml' })).toBe(true)
      })

      it('should reject non-image MIME types', () => {
        expect(isImageFile({ mimeType: 'application/pdf' })).toBe(false)
        expect(isImageFile({ mimeType: 'text/plain' })).toBe(false)
        expect(isImageFile({ mimeType: 'application/zip' })).toBe(false)
        expect(isImageFile({ mimeType: 'video/mp4' })).toBe(false)
      })
    })

    describe('filename extension fallback', () => {
      it('should detect images by extension when MIME type is missing', () => {
        expect(isImageFile({ filename: 'photo.jpg' })).toBe(true)
        expect(isImageFile({ filename: 'image.jpeg' })).toBe(true)
        expect(isImageFile({ filename: 'icon.png' })).toBe(true)
        expect(isImageFile({ filename: 'banner.gif' })).toBe(true)
        expect(isImageFile({ filename: 'picture.webp' })).toBe(true)
        expect(isImageFile({ filename: 'logo.svg' })).toBe(true)
      })

      it('should reject non-images by extension', () => {
        expect(isImageFile({ filename: 'document.pdf' })).toBe(false)
        expect(isImageFile({ filename: 'readme.txt' })).toBe(false)
        expect(isImageFile({ filename: 'archive.zip' })).toBe(false)
      })

      it('should handle case insensitivity for extensions', () => {
        expect(isImageFile({ filename: 'PHOTO.JPG' })).toBe(true)
        expect(isImageFile({ filename: 'Image.PNG' })).toBe(true)
      })
    })

    describe('MIME type priority', () => {
      it('should prioritize MIME type over filename', () => {
        // MIME type says image, filename says PDF
        expect(isImageFile({
          mimeType: 'image/jpeg',
          filename: 'disguised.pdf'
        })).toBe(true)

        // MIME type says PDF, filename says image
        expect(isImageFile({
          mimeType: 'application/pdf',
          filename: 'disguised.jpg'
        })).toBe(false)
      })
    })

    describe('edge cases', () => {
      it('should return false for empty object', () => {
        expect(isImageFile({})).toBe(false)
      })

      it('should return false for files without extension', () => {
        expect(isImageFile({ filename: 'README' })).toBe(false)
      })

      it('should return false for empty filename', () => {
        expect(isImageFile({ filename: '' })).toBe(false)
      })
    })
  })
})
