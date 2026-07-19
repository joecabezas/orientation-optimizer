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
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">Generation {label}</div>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="chart-tooltip-row">
          <span className="chart-tooltip-swatch" style={{ background: entry.color }} />
          <span>{entry.name}</span>
          <span className="mono">{entry.value.toFixed(4)}</span>
        </div>
      ))}
    </div>
  )
}

export function FitnessChart({ history }: FitnessChartProps) {
  const [showAverage, setShowAverage] = useState(true)
  const data = useMemo(() => [...history], [history])

  return (
    <div className="viz-root fitness-chart">
      <div className="fitness-chart-header">
        <span className="fitness-chart-title">Support score vs. generation</span>
        <label className="fitness-chart-toggle">
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
      <div className="fitness-chart-legend">
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: COLOR_BEST }} /> Best score
        </span>
        {showAverage && (
          <span className="legend-item">
            <span className="legend-swatch" style={{ background: COLOR_AVG }} /> Population average
          </span>
        )}
      </div>
    </div>
  )
}
