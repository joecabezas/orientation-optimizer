import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export interface FitnessHistoryPoint {
  readonly generation: number
  readonly bestScore: number
  readonly averageScore: number
}

interface FitnessChartProps {
  readonly history: readonly FitnessHistoryPoint[]
}

const COLOR_BEST = '#3987e5' // categorical slot 1 (blue), dark-mode step
const COLOR_AVG = '#008300' // categorical slot 2 (green)

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-border-hairline bg-surface-3 px-2.5 py-2 text-xs">
      <div className="mb-1 text-text-muted">Generation {label}</div>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-1.5 text-text-primary">
          <span className="h-2 w-2 rounded-sm" style={{ background: entry.color }} />
          <span>{entry.name}</span>
          <span className="font-mono tabular-nums">{entry.value.toFixed(4)}</span>
        </div>
      ))}
    </div>
  )
}

export function FitnessChart({ history }: FitnessChartProps) {
  const [showAverage, setShowAverage] = useState(true)
  const data = useMemo(() => [...history], [history])

  return (
    <div className="rounded-[10px] border border-border-hairline bg-surface-1 px-4 pt-[14px] pb-1.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-text-primary">Support score vs. generation</span>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={showAverage}
            onChange={(e) => setShowAverage(e.target.checked)}
          />
          Show population average
        </label>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="#2c2c2a" vertical={false} />
          <XAxis
            dataKey="generation"
            stroke="#898781"
            tick={{ fill: '#898781', fontSize: 12 }}
            label={{ value: 'Generation', position: 'insideBottom', offset: -4, fill: '#898781', fontSize: 12 }}
          />
          <YAxis stroke="#898781" tick={{ fill: '#898781', fontSize: 12 }} width={56} />
          <Tooltip content={<ChartTooltip />} />
          <Line
            type="monotone"
            dataKey="bestScore"
            name="Best score"
            stroke={COLOR_BEST}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          {showAverage && (
            <Line
              type="monotone"
              dataKey="averageScore"
              name="Population average"
              stroke={COLOR_AVG}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      <div className="flex gap-4 px-1 pt-1 pb-2">
        <span className="flex items-center gap-1.5 text-xs text-text-secondary">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_BEST }} /> Best score
        </span>
        {showAverage && (
          <span className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_AVG }} /> Population average
          </span>
        )}
      </div>
    </div>
  )
}
