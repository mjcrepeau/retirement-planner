import type { TaxBracket } from '../../types';
import { scaleBrackets } from '../../utils/taxBrackets';
import {
  TAX_BRACKETS_MFJ,
  TAX_BRACKETS_SINGLE,
  STANDARD_DEDUCTION_MFJ,
  STANDARD_DEDUCTION_SINGLE,
  CAPITAL_GAINS_BRACKETS_MFJ,
  CAPITAL_GAINS_BRACKETS_SINGLE,
  SS_TAXABILITY_THRESHOLDS,
} from './constants';

export function getTaxBrackets(filingStatus?: string): TaxBracket[] {
  return filingStatus === 'married_filing_jointly'
    ? TAX_BRACKETS_MFJ
    : TAX_BRACKETS_SINGLE;
}

export function getStandardDeduction(filingStatus?: string): number {
  return filingStatus === 'married_filing_jointly'
    ? STANDARD_DEDUCTION_MFJ
    : STANDARD_DEDUCTION_SINGLE;
}

export function getCapitalGainsBrackets(filingStatus?: string): TaxBracket[] {
  return filingStatus === 'married_filing_jointly'
    ? CAPITAL_GAINS_BRACKETS_MFJ
    : CAPITAL_GAINS_BRACKETS_SINGLE;
}

/**
 * Calculate federal income tax on ordinary income.
 *
 * `indexFactor` scales bracket boundaries for future-year projections
 * (brackets are indexed to inflation under current law); 1 = current year.
 */
export function calculateFederalIncomeTax(
  taxableIncome: number,
  filingStatus?: string,
  indexFactor: number = 1
): number {
  if (taxableIncome <= 0) return 0;

  const brackets = scaleBrackets(getTaxBrackets(filingStatus), indexFactor);
  let tax = 0;
  let remainingIncome = taxableIncome;

  for (const bracket of brackets) {
    const bracketWidth = bracket.max - bracket.min;
    const incomeInBracket = Math.min(remainingIncome, bracketWidth);

    if (incomeInBracket <= 0) break;

    tax += incomeInBracket * bracket.rate;
    remainingIncome -= incomeInBracket;
  }

  return tax;
}

/**
 * Calculate capital gains tax
 */
export function calculateCapitalGainsTax(
  capitalGains: number,
  otherTaxableIncome: number,
  filingStatus?: string,
  indexFactor: number = 1
): number {
  if (capitalGains <= 0) return 0;

  const brackets = scaleBrackets(getCapitalGainsBrackets(filingStatus), indexFactor);
  const standardDeduction = getStandardDeduction(filingStatus) * indexFactor;

  const incomeBase = Math.max(0, otherTaxableIncome - standardDeduction);

  let tax = 0;
  let remainingGains = capitalGains;
  let currentIncome = incomeBase;

  for (const bracket of brackets) {
    if (remainingGains <= 0) break;

    const roomInBracket = Math.max(0, bracket.max - currentIncome);
    const gainsInBracket = Math.min(remainingGains, roomInBracket);

    if (gainsInBracket > 0 && currentIncome + gainsInBracket > bracket.min) {
      const effectiveGains = Math.min(
        gainsInBracket,
        currentIncome + gainsInBracket - Math.max(bracket.min, currentIncome)
      );
      tax += effectiveGains * bracket.rate;
    }

    currentIncome += gainsInBracket;
    remainingGains -= gainsInBracket;
  }

  return tax;
}

/**
 * Calculate the taxable portion of Social Security benefits using the
 * provisional-income phase-in (IRC §86).
 *
 * Provisional income = other income + 50% of SS benefits. Below the base
 * threshold none of SS is taxable; between base and upper up to 50% phases
 * in; above upper up to 85% phases in.
 *
 * The thresholds are deliberately NOT inflation-indexed — they are frozen
 * by statute — so nominal future incomes are compared against them as-is.
 * Over long horizons this pushes most retirees to the 85% maximum, which
 * matches current law.
 *
 * @param annualSS - Annual Social Security benefits (nominal dollars)
 * @param otherIncome - All other income counted in provisional income
 *   (ordinary income excluding SS, plus capital gains), nominal dollars
 */
export function calculateTaxableSocialSecurity(
  annualSS: number,
  otherIncome: number,
  filingStatus?: string
): number {
  if (annualSS <= 0) return 0;

  const thresholds = filingStatus === 'married_filing_jointly'
    ? SS_TAXABILITY_THRESHOLDS.married_filing_jointly
    : SS_TAXABILITY_THRESHOLDS.single;

  const provisionalIncome = otherIncome + 0.5 * annualSS;

  if (provisionalIncome <= thresholds.base) return 0;

  if (provisionalIncome <= thresholds.upper) {
    return Math.min(0.5 * (provisionalIncome - thresholds.base), 0.5 * annualSS);
  }

  const tier1 = Math.min(0.5 * (thresholds.upper - thresholds.base), 0.5 * annualSS);
  return Math.min(
    0.85 * (provisionalIncome - thresholds.upper) + tier1,
    0.85 * annualSS
  );
}

/**
 * Calculate total federal tax
 */
export function calculateTotalFederalTax(
  ordinaryIncome: number,
  capitalGains: number,
  filingStatus?: string,
  indexFactor: number = 1
): number {
  const standardDeduction = getStandardDeduction(filingStatus) * indexFactor;
  const taxableOrdinaryIncome = Math.max(0, ordinaryIncome - standardDeduction);

  const incomeTax = calculateFederalIncomeTax(taxableOrdinaryIncome, filingStatus, indexFactor);
  const capitalGainsTax = calculateCapitalGainsTax(capitalGains, ordinaryIncome, filingStatus, indexFactor);

  return incomeTax + capitalGainsTax;
}
