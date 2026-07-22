import { ScoreExplanationSummary } from '../scoreExplanation'

interface ScoreExplainerPopoverProps {
  readonly summary: ScoreExplanationSummary
  readonly onClose: () => void
}

/**
 * Small panel summarizing why a genome's score is what it is, anchored below
 * the clickable score it explains. Meant to be shown/hidden by the caller
 * (see App.tsx) rather than managing its own open state, since the 3D view's
 * contribution color ramp needs to turn on and off in lockstep with it.
 */
export function ScoreExplainerPopover({ summary, onClose }: ScoreExplainerPopoverProps) {
  return (
    <div
      data-testid="score-explainer-popover"
      className="absolute top-full left-0 z-20 mt-2 w-80 rounded-lg border border-border-hairline bg-surface-2 p-3.5 text-left shadow-lg"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-[0.06em] text-text-muted uppercase">Score explainer</span>
        <button
          type="button"
          className="cursor-pointer rounded px-1 text-[13px] leading-none text-text-muted hover:text-text-primary"
          onClick={onClose}
          aria-label="Close score explainer"
        >
          ×
        </button>
      </div>

      <p className="m-0 mb-1 font-mono text-[15px] font-semibold text-text-primary">
        {summary.totalScore.toFixed(4)}{' '}
        <span className="font-display text-[11px] font-normal text-text-muted">({summary.strategyName})</span>
      </p>

      <p className="m-0 text-[12px] leading-snug text-text-secondary">{summary.summaryText}</p>

      <p className="m-0 mt-2 text-[11px] text-text-muted">
        Triangles in the 3D view are colored by contribution: blue (none) → amber → red (highest).
      </p>
    </div>
  )
}
