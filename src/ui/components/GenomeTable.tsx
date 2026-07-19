import { Individual } from '../../domain/individual'
import { genomeToEulerDegrees } from '../../domain/genome'

interface GenomeTableProps {
  readonly population: readonly Individual[]
  readonly selectedGenomeId: string | undefined
  readonly onSelectGenome: (genomeId: string) => void
}

function fmt(n: number): string {
  return n.toFixed(1)
}

export function GenomeTable({ population, selectedGenomeId, onSelectGenome }: GenomeTableProps) {
  return (
    <div className="genome-table-wrap">
      <table className="genome-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Genome</th>
            <th>Quaternion (x, y, z, w)</th>
            <th>Euler° (x, y, z)</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {population.map((ind, i) => {
            const q = ind.genome.rotation
            const e = genomeToEulerDegrees(ind.genome)
            const isSelected = ind.genome.id === selectedGenomeId
            return (
              <tr
                key={ind.genome.id}
                className={isSelected ? 'selected' : undefined}
                onClick={() => onSelectGenome(ind.genome.id)}
              >
                <td>{i + 1}</td>
                <td className="mono">{ind.genome.id}</td>
                <td className="mono">
                  {fmt(q.x)}, {fmt(q.y)}, {fmt(q.z)}, {fmt(q.w)}
                </td>
                <td className="mono">
                  {fmt(e.x)}, {fmt(e.y)}, {fmt(e.z)}
                </td>
                <td className="mono">{ind.score.toFixed(4)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
