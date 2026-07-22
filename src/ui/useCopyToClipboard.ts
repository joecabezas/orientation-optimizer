import { useCallback, useEffect, useRef, useState } from 'react'

const FEEDBACK_DURATION_MS = 1500

/**
 * Copies text to the clipboard and exposes a short-lived `copied` flag so a
 * caller can show local "Copied" feedback (e.g. a small tooltip) that reverts
 * on its own after `durationMs`. There is no app-wide toast system — this is
 * meant to back per-element feedback, not a shared notification.
 */
export function useCopyToClipboard(durationMs: number = FEEDBACK_DURATION_MS) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== undefined) clearTimeout(timeoutRef.current)
    }
  }, [])

  const copy = useCallback(
    (text: string) => {
      void navigator.clipboard.writeText(text)
      setCopied(true)
      if (timeoutRef.current !== undefined) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setCopied(false), durationMs)
    },
    [durationMs],
  )

  return { copied, copy }
}
