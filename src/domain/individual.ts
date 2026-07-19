import { Genome } from './genome'

/** A genome paired with its evaluated fitness. Lower score is better (less support material). */
export interface Individual {
  readonly genome: Genome
  readonly score: number
}
