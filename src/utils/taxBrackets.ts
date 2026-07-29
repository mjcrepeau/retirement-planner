import type { TaxBracket } from '../types';

/**
 * Scale a bracket table's boundaries by an indexation factor.
 *
 * The projection engine works in nominal (future) dollars while bracket
 * constants are defined in current-tax-year dollars. Both US and Canadian
 * law index brackets, deductions, and basic personal amounts to inflation
 * annually, so projections scale them by the cumulative inflation multiplier
 * for the simulated year. A factor of 1 returns the table unchanged.
 */
export function scaleBrackets(brackets: TaxBracket[], factor: number): TaxBracket[] {
  if (factor === 1) return brackets;
  return brackets.map(bracket => ({
    min: bracket.min * factor,
    max: bracket.max === Infinity ? Infinity : bracket.max * factor,
    rate: bracket.rate,
  }));
}
