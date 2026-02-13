// ---------------------------------------------------------------------------
// postMessage Bridge: Builder (parent) ↔ Preview (iframe)
//
// All messages are wrapped in an envelope with a channel identifier so other
// postMessage traffic is ignored. Origin + source validation on all listeners.
// ---------------------------------------------------------------------------

const BRIDGE_CHANNEL = 'sophie-preview-bridge' as const

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

/** Messages sent from the builder page (parent) to the preview iframe */
export type ParentMessage =
  | { type: 'refreshRequested' }
  | { type: 'activeModuleChanged'; slug: string }
  | { type: 'editModeChanged'; enabled: boolean }
  | { type: 'openWidgetConfig'; widgetId: string | null;
      sectionId: string; dashboardId: string }

/** Messages sent from the preview iframe to the builder page (parent) */
export type ChildMessage =
  | { type: 'previewReady' }
  | { type: 'previewError'; message: string }
  | { type: 'activeModuleReport'; moduleSlug: string;
      dashboardId: string | null }
  | { type: 'widgetEditRequested'; widgetId: string;
      sectionId: string; dashboardId: string }
  | { type: 'compositionSaved' }
  | { type: 'addWidgetRequested'; sectionId: string;
      dashboardId: string }

interface BridgeEnvelope<T> {
  channel: typeof BRIDGE_CHANNEL
  payload: T
}

// ---------------------------------------------------------------------------
// Parent → iframe helpers
// ---------------------------------------------------------------------------

/** Send a message from the builder page to the preview iframe */
export function sendToPreview(
  iframe: HTMLIFrameElement | null,
  message: ParentMessage
): void {
  if (!iframe?.contentWindow) return

  const envelope: BridgeEnvelope<ParentMessage> = {
    channel: BRIDGE_CHANNEL,
    payload: message,
  }

  iframe.contentWindow.postMessage(envelope, window.location.origin)
}

/**
 * Listen for messages from the preview iframe. Returns cleanup function.
 *
 * Pass the iframe element ref so the listener can verify event.source matches
 * the expected iframe contentWindow (prevents other same-origin windows from
 * injecting messages).
 */
export function listenFromPreview(
  callback: (msg: ChildMessage) => void,
  iframeRef?: React.RefObject<HTMLIFrameElement | null>,
): () => void {
  function handler(event: MessageEvent) {
    if (event.origin !== window.location.origin) return

    // Source validation: only accept messages from the expected iframe
    if (iframeRef?.current?.contentWindow && event.source !== iframeRef.current.contentWindow) return

    const data = event.data as BridgeEnvelope<ChildMessage> | undefined
    if (!data || data.channel !== BRIDGE_CHANNEL) return

    callback(data.payload)
  }

  window.addEventListener('message', handler)
  return () => window.removeEventListener('message', handler)
}

// ---------------------------------------------------------------------------
// iframe → parent helpers
// ---------------------------------------------------------------------------

/** Send a message from the preview iframe to the builder page (parent) */
export function sendToParent(message: ChildMessage): void {
  if (typeof window === 'undefined' || !window.parent || window.parent === window) return

  const envelope: BridgeEnvelope<ChildMessage> = {
    channel: BRIDGE_CHANNEL,
    payload: message,
  }

  window.parent.postMessage(envelope, window.location.origin)
}

/** Listen for messages from the builder page (parent). Returns cleanup function. */
export function listenFromParent(
  callback: (msg: ParentMessage) => void
): () => void {
  function handler(event: MessageEvent) {
    if (event.origin !== window.location.origin) return

    // Source validation: only accept messages from the parent window
    if (event.source !== window.parent) return

    const data = event.data as BridgeEnvelope<ParentMessage> | undefined
    if (!data || data.channel !== BRIDGE_CHANNEL) return

    callback(data.payload)
  }

  window.addEventListener('message', handler)
  return () => window.removeEventListener('message', handler)
}
