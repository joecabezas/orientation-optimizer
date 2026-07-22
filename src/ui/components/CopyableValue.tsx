import { MouseEvent, ReactNode } from 'react'
import { useCopyToClipboard } from '../useCopyToClipboard'

interface CopyableValueProps {
  /** Raw, full-precision text written to the clipboard — not necessarily what `children` renders. */
  readonly value: string
  readonly children: ReactNode
  readonly className?: string
}

/**
 * Makes a displayed value clickable to copy `value` (verbatim) to the
 * clipboard, showing a brief "Copied" tooltip as feedback. Stops the click
 * from bubbling so it doesn't also trigger a parent element's own onClick
 * (e.g. a table row's select-on-click).
 */
export function CopyableValue({ value, children, className = '' }: CopyableValueProps) {
  const { copied, copy } = useCopyToClipboard()

  function handleClick(event: MouseEvent<HTMLSpanElement>) {
    event.stopPropagation()
    copy(value)
  }

  return (
    <span
      className={`relative inline-block cursor-pointer ${className}`}
      onClick={handleClick}
      title="Click to copy"
    >
      {children}
      {copied && (
        <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
          Copied
        </span>
      )}
    </span>
  )
}
