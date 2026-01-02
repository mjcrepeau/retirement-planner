import type { TaxBracket } from '../../types';
import {
  TAX_BRACKETS_MFJ,
  TAX_BRACKETS_SINGLE,
  STANDARD_DEDUCTION_MFJ,
  STANDARD_DEDUCTION_SINGLE,
  CAPITAL_GAINS_BRACKETS_MFJ,
  CAPITAL_GAINS_BRACKETS_SINGLE,
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
 * Calculate federal income tax on ordinary income
 */
export function calculateFederalIncomeTax(
  taxableIncome: number,
  filingStatus?: string
): number {
  if (taxableIncome <= 0) return 0;

  const brackets = getTaxBrackets(filingStatus);
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
  filingStatus?: string
): number {
  if (capitalGains <= 0) return 0;

  const brackets = getCapitalGainsBrackets(filingStatus);
  const standardDeduction = getStandardDeduction(filingStatus);

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
 * Calculate total federal tax
 */
export function calculateTotalFederalTax(
  ordinaryIncome: number,
  capitalGains: number,
  filingStatus?: string
): number {
  const standardDeduction = getStandardDeduction(filingStatus);
  const taxableOrdinaryIncome = Math.max(0, ordinaryIncome - standardDeduction);

  const incomeTax = calculateFederalIncomeTax(taxableOrdinaryIncome, filingStatus);
  const capitalGainsTax = calculateCapitalGainsTax(capitalGains, ordinaryIncome, filingStatus);

  return incomeTax + capitalGainsTax;
}
