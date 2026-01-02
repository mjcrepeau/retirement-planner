import type { TaxBracket } from '../../types';
import {
  FEDERAL_TAX_BRACKETS,
  FEDERAL_BASIC_PERSONAL_AMOUNT,
  PROVINCIAL_TAX_BRACKETS,
  PROVINCIAL_BASIC_PERSONAL_AMOUNTS,
  CAPITAL_GAINS_INCLUSION_RATE_DEFAULT,
  CAPITAL_GAINS_INCLUSION_RATE_HIGH,
  CAPITAL_GAINS_THRESHOLD,
} from './constants';

/**
 * Calculate tax using progressive brackets
 */
function calculateProgressiveTax(income: number, brackets: TaxBracket[]): number {
  if (income <= 0) return 0;

  let tax = 0;
  let remainingIncome = income;

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
 * Calculate federal income tax (Canada)
 */
export function calculateFederalIncomeTax(income: number): number {
  const taxableIncome = Math.max(0, income - FEDERAL_BASIC_PERSONAL_AMOUNT);
  return calculateProgressiveTax(taxableIncome, FEDERAL_TAX_BRACKETS);
}

/**
 * Calculate provincial income tax
 */
export function calculateProvincialIncomeTax(income: number, provinceCode: string): number {
  const brackets = PROVINCIAL_TAX_BRACKETS[provinceCode];
  const basicPersonalAmount = PROVINCIAL_BASIC_PERSONAL_AMOUNTS[provinceCode] || 0;

  if (!brackets) {
    console.warn(`No tax brackets found for province: ${provinceCode}`);
    return 0;
  }

  const taxableIncome = Math.max(0, income - basicPersonalAmount);
  return calculateProgressiveTax(taxableIncome, brackets);
}

/**
 * Calculate total Canadian tax (federal + provincial)
 */
export function calculateTotalCanadianTax(
  income: number,
  provinceCode: string
): number {
  const federalTax = calculateFederalIncomeTax(income);
  const provincialTax = calculateProvincialIncomeTax(income, provinceCode);
  return federalTax + provincialTax;
}

/**
 * Calculate tax on capital gains (Canadian treatment)
 * In Canada, only a portion of capital gains is taxable (inclusion rate)
 * 50% for first $250k, 66.67% for amounts over $250k (as of 2024)
 */
export function calculateCapitalGainsTax(
  capitalGains: number,
  provinceCode: string
): number {
  if (capitalGains <= 0) return 0;

  let taxableGains = 0;

  if (capitalGains <= CAPITAL_GAINS_THRESHOLD) {
    // All gains under threshold at 50% inclusion
    taxableGains = capitalGains * CAPITAL_GAINS_INCLUSION_RATE_DEFAULT;
  } else {
    // First $250k at 50%, remainder at 66.67%
    const gainsAtLowerRate = CAPITAL_GAINS_THRESHOLD * CAPITAL_GAINS_INCLUSION_RATE_DEFAULT;
    const excessGains = (capitalGains - CAPITAL_GAINS_THRESHOLD) * CAPITAL_GAINS_INCLUSION_RATE_HIGH;
    taxableGains = gainsAtLowerRate + excessGains;
  }

  // Taxable gains are added to regular income and taxed at marginal rates
  return calculateTotalCanadianTax(taxableGains, provinceCode);
}

/**
 * Calculate combined tax on ordinary income and capital gains
 */
export function calculateTotalTax(
  ordinaryIncome: number,
  capitalGains: number,
  provinceCode: string
): number {
  // Calculate taxable portion of capital gains
  let taxableGains = 0;
  if (capitalGains > 0) {
    if (capitalGains <= CAPITAL_GAINS_THRESHOLD) {
      taxableGains = capitalGains * CAPITAL_GAINS_INCLUSION_RATE_DEFAULT;
    } else {
      const gainsAtLowerRate = CAPITAL_GAINS_THRESHOLD * CAPITAL_GAINS_INCLUSION_RATE_DEFAULT;
      const excessGains = (capitalGains - CAPITAL_GAINS_THRESHOLD) * CAPITAL_GAINS_INCLUSION_RATE_HIGH;
      taxableGains = gainsAtLowerRate + excessGains;
    }
  }

  // Total taxable income
  const totalTaxableIncome = ordinaryIncome + taxableGains;

  return calculateTotalCanadianTax(totalTaxableIncome, provinceCode);
}

/**
 * Get marginal tax rate (federal + provincial)
 */
export function getMarginalTaxRate(income: number, provinceCode: string): number {
  const federalBrackets = FEDERAL_TAX_BRACKETS;
  const provincialBrackets = PROVINCIAL_TAX_BRACKETS[provinceCode] || [];

  const taxableIncome = Math.max(0, income - FEDERAL_BASIC_PERSONAL_AMOUNT);

  // Find federal marginal rate
  let federalRate = 0;
  for (const bracket of federalBrackets) {
    if (taxableIncome <= bracket.max) {
      federalRate = bracket.rate;
      break;
    }
  }
  if (federalRate === 0 && federalBrackets.length > 0) {
    federalRate = federalBrackets[federalBrackets.length - 1].rate;
  }

  // Find provincial marginal rate
  const provincialBasic = PROVINCIAL_BASIC_PERSONAL_AMOUNTS[provinceCode] || 0;
  const provincialTaxableIncome = Math.max(0, income - provincialBasic);

  let provincialRate = 0;
  for (const bracket of provincialBrackets) {
    if (provincialTaxableIncome <= bracket.max) {
      provincialRate = bracket.rate;
      break;
    }
  }
  if (provincialRate === 0 && provincialBrackets.length > 0) {
    provincialRate = provincialBrackets[provincialBrackets.length - 1].rate;
  }

  return federalRate + provincialRate;
}
