import type { TaxBracket } from '../../types';
import {
  FEDERAL_TAX_BRACKETS,
  FEDERAL_BASIC_PERSONAL_AMOUNT,
  PROVINCIAL_TAX_BRACKETS,
  PROVINCIAL_BASIC_PERSONAL_AMOUNTS,
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
