import { Individual } from '../../domain/individual'
import { genomeToEulerDegrees } from '../../domain/genome'
import { CopyableValue } from './CopyableValue'

interface GenomeTableProps {
  readonly population: readonly Individual[]
  readonly selectedGenomeId: string | undefined
  readonly onSelectGenome: (genomeId: string) => void
}

function fmt(n: number): string {
  return n.toFixed(1)
}

const thClass =
  'sticky top-0 border-b border-border-hairline bg-surface-2 px-3 py-2 text-left text-[11px] font-semibold tracking-[0.04em] text-text-muted uppercase'

export function GenomeTable({ population, selectedGenomeId, onSelectGenome }: GenomeTableProps) {
  return (
    <div
      data-testid="genome-table"
      className="h-full overflow-auto rounded-[10px] border border-border-hairline bg-surface-1"
    >
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className={thClass}>#</th>
            <th className={thClass}>Genome</th>
            <th className={thClass}>Quaternion (x, y, z, w)</th>
            <th className={thClass}>Euler° (x, y, z)</th>
            <th className={thClass}>Score</th>
          </tr>
        </thead>
        <tbody>
          {population.map((ind, i) => {
            const q = ind.genome.rotation
            const e = genomeToEulerDegrees(ind.genome)
            const isSelected = ind.genome.id === selectedGenomeId
            const tdClass =
              'border-b border-border-hairline px-3 py-1.5 ' +
              (isSelected ? 'bg-accent/12 text-text-primary' : 'text-text-secondary group-hover:bg-surface-2')
            return (
              <tr
                key={ind.genome.id}
                className="group cursor-pointer"
                data-selected={isSelected}
                onClick={() => onSelectGenome(ind.genome.id)}
              >
                <td className={tdClass}>{i + 1}</td>
                <td className={`${tdClass} font-mono`}>{ind.genome.id}</td>
                <td className={`${tdClass} font-mono tabular-nums`}>
                  <CopyableValue value={`${q.x}, ${q.y}, ${q.z}, ${q.w}`} className="block">
                    {fmt(q.x)}, {fmt(q.y)}, {fmt(q.z)}, {fmt(q.w)}
                  </CopyableValue>
                </td>
                <td className={`${tdClass} font-mono tabular-nums`}>
                  <CopyableValue value={`${e.x}, ${e.y}, ${e.z}`} className="block">
                    {fmt(e.x)}, {fmt(e.y)}, {fmt(e.z)}
                  </CopyableValue>
                </td>
                <td className={`${tdClass} font-mono tabular-nums`}>{ind.score.toFixed(4)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
