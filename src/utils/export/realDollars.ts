/**
 * Nominal <-> real (today's dollars) conversion.
 *
 * Every number produced by the projection engine is *nominal*: the actual
 * dollars changing hands in that future year. `projections.ts` compounds
 * balances at each account's return rate, and `withdrawals.ts` inflates the
 * spending target, benefits, and income streams year over year. Nothing is
 * deflated back to present value.
 *
 * Anything that presents "today's dollars" must divide by the inflation factor
 * for that year — see SummaryCards and the CSV/print exports.
 */

/**
 * Cumulative inflation multiplier between today and `yearsFromNow`.
 * Divide a nominal amount by this to get today's-dollar purchasing power.
 */
export function inflationFactor(yearsFromNow: number, inflationRate: number): number {
  if (yearsFromNow <= 0) return 1;
  return Math.pow(1 + inflationRate, yearsFromNow);
}

/** Convert a future nominal amount to its present (today's-dollar) value. */
export function presentValue(
  nominalAmount: number,
  yearsFromNow: number,
  inflationRate: number
): number {
  return nominalAmount / inflationFactor(yearsFromNow, inflationRate);
}
