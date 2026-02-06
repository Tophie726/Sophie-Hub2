/**
 * Shared validation for feedback attachment URLs.
 * Allows http/https links and safe data URIs for image/PDF uploads.
 */

const DATA_IMAGE_URI_RE = /^data:image\/[a-z0-9.+-]+(?:;[a-z0-9=+.-]+)*(?:;base64)?,/i
const DATA_PDF_URI_RE = /^data:application\/pdf(?:;[a-z0-9=+.-]+)*(?:;base64)?,/i

export const ATTACHMENT_URL_VALIDATION_MESSAGE =
  'URL must use http/https or be a data:image/data:application/pdf URI'

export function isAllowedAttachmentUrl(url: string): boolean {
  const normalized = url.trim()
  if (!normalized) return false

  const lower = normalized.toLowerCase()
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    return true
  }

  return DATA_IMAGE_URI_RE.test(normalized) || DATA_PDF_URI_RE.test(normalized)
}

export function safeAttachmentHref(url: string): string {
  const normalized = url.trim()
  return isAllowedAttachmentUrl(normalized) ? normalized : '#'
}
