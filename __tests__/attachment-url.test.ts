import { isAllowedAttachmentUrl, safeAttachmentHref } from '@/lib/security/attachment-url'

describe('attachment URL validation', () => {
  it('allows http and https URLs', () => {
    expect(isAllowedAttachmentUrl('https://example.com/file.pdf')).toBe(true)
    expect(isAllowedAttachmentUrl('http://example.com/image.png')).toBe(true)
  })

  it('allows supported data URLs (image + pdf)', () => {
    expect(isAllowedAttachmentUrl('data:image/png;base64,AAAA')).toBe(true)
    expect(isAllowedAttachmentUrl('data:image/svg+xml;base64,AAAA')).toBe(true)
    expect(isAllowedAttachmentUrl('data:application/pdf;base64,AAAA')).toBe(true)
  })

  it('rejects unsupported schemes and MIME types', () => {
    expect(isAllowedAttachmentUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedAttachmentUrl('vbscript:alert(1)')).toBe(false)
    expect(isAllowedAttachmentUrl('data:text/html;base64,AAAA')).toBe(false)
    expect(isAllowedAttachmentUrl('data:application/javascript;base64,AAAA')).toBe(false)
    expect(isAllowedAttachmentUrl('file:///tmp/file.pdf')).toBe(false)
  })

  it('rejects empty values', () => {
    expect(isAllowedAttachmentUrl('')).toBe(false)
    expect(isAllowedAttachmentUrl('   ')).toBe(false)
  })

  it('safeAttachmentHref returns # for invalid URLs', () => {
    expect(safeAttachmentHref('javascript:alert(1)')).toBe('#')
  })

  it('safeAttachmentHref returns trimmed allowed URLs', () => {
    expect(safeAttachmentHref(' https://example.com/file.pdf ')).toBe('https://example.com/file.pdf')
    expect(safeAttachmentHref(' data:image/png;base64,AAAA ')).toBe('data:image/png;base64,AAAA')
  })
})
