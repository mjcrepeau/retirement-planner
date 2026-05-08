import type { ConversionPlan, FilingStatus } from '../types';
import {
  calculateTotalFederalTax,
  calculateStateTax,
  getStandardDeduction,
} from './taxes';

export interface ConversionTaxDeltaInput {
  incomeForYear: number;          // nominal ordinary income, pre-conversion
  conversionTotalForYear: number; // nominal sum of all active conversions
  filingStatus: FilingStatus;
  stateTaxRate: number;
  // Optional bracket-indexing factor for the year being evaluated.
  // (1 + FEDERAL_BRACKET_INFLATION_RATIO × inflation)^yearsFromNow. Applied via
  // deflate-compute-scale on the federal tax functions (mathematically equivalent
  // to scaling all bracket boundaries by this factor) plus scaling the std
  // deduction in the state-tax base. Defaults to 1 (no indexing).
  bracketInflationMultiplier?: number;
}

/**
 * Federal + state tax delta from adding a conversion total to ordinary income,
 * computed via two-pass evaluation through the existing tax engine. Captures
 * bracket-straddle effects exactly (no marginal-rate approximation).
 */
export function calculateConversionTaxDelta(input: ConversionTaxDeltaInput): number {
  if (input.conversionTotalForYear <= 0) return 0;

  const { incomeForYear, conversionTotalForYear, filingStatus, stateTaxRate } = input;
  const m = input.bracketInflationMultiplier ?? 1;
  const stdDed = getStandardDeduction(filingStatus) * m;

  // Deflate income to today's-bracket scale, compute, scale tax back up.
  const fedWithout = calculateTotalFederalTax(incomeForYear / m, 0, filingStatus) * m;
  const fedWith = calculateTotalFederalTax(
    (incomeForYear + conversionTotalForYear) / m, 0, filingStatus,
  ) * m;

  // State tax is flat-rate in this model; the std-ded floor scales with brackets.
  const stateWithout = calculateStateTax(Math.max(0, incomeForYear - stdDed), stateTaxRate);
  const stateWith = calculateStateTax(
    Math.max(0, incomeForYear + conversionTotalForYear - stdDed),
    stateTaxRate,
  );

  return (fedWith + stateWith) - (fedWithout + stateWithout);
}

export interface ApplyConversionsInput {
  age: number;
  yearsFromNow: number;       // age - currentAge
  plans: ConversionPlan[];
  balances: Record<string, number>; // accountId -> running balance (mutated)
  inflationRate: number;
}

export interface ConversionApplyResult {
  totalConvertedThisYear: number; // sum of nominal converted amounts across plans
}

/**
 * Apply all active conversion plans for a single year. Mutates `balances`.
 * - Capped silently at source balance (per design Q7).
 * - Plans processed in list order; later plans see balances drained by earlier ones.
 */
export function applyConversionsForYear(input: ApplyConversionsInput): ConversionApplyResult {
  const { age, yearsFromNow, plans, balances, inflationRate } = input;
  const inflationFactor = Math.pow(1 + inflationRate, yearsFromNow);

  let total = 0;
  for (const plan of plans) {
    if (age < plan.startAge || age > plan.endAge) continue;

    const requested = plan.yearlyAmount * inflationFactor;
    const available = balances[plan.sourceAccountId] ?? 0;
    const actual = Math.min(requested, Math.max(0, available));
    if (actual <= 0) continue;

    balances[plan.sourceAccountId] = available - actual;
    balances[plan.destinationAccountId] = (balances[plan.destinationAccountId] ?? 0) + actual;
    total += actual;
  }

  return { totalConvertedThisYear: total };
}
