import { redirect } from 'next/navigation'

/**
 * Fallback route for /preview/module/[slug].
 *
 * Module navigation within the preview iframe is handled client-side
 * via PreviewContext.setActiveModule (intercepted in PreviewShellInner).
 * If a user navigates here directly (e.g. browser refresh), redirect
 * them back to the main preview page since the token context is lost.
 */
export default function PreviewModuleFallback() {
  redirect('/admin/views')
}
