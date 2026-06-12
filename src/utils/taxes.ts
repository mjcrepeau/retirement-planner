import { FilingStatus, TaxBracket } from '../types';
import * as usaTaxes from '../countries/usa/taxes';

// The core US federal tax math (brackets, standard deduction, capital gains
// brackets, and the tax calculation functions) is defined canonically in
// src/countries/usa/taxes.ts. These thin wrappers re-expose that logic with
// the stricter `FilingStatus` type used throughout the app-level utils.

export function getTaxBrackets(filingStatus: FilingStatus): TaxBracket[] {
  return usaTaxes.getTaxBrackets(filingStatus);
}

export function getStandardDeduction(filingStatus: FilingStatus): number {
  return usaTaxes.getStandardDeduction(filingStatus);
}

export function getCapitalGainsBrackets(filingStatus: FilingStatus): TaxBracket[] {
  return usaTaxes.getCapitalGainsBrackets(filingStatus);
}

/**
 * Calculate federal income tax on ordinary income
 */
export function calculateFederalIncomeTax(
  taxableIncome: number,
  filingStatus: FilingStatus
): number {
  return usaTaxes.calculateFederalIncomeTax(taxableIncome, filingStatus);
}

/**
 * Calculate capital gains tax on taxable brokerage withdrawals
 * Simplified: treats the entire gain portion at long-term capital gains rates
 */
export function calculateCapitalGainsTax(
  capitalGains: number,
  otherTaxableIncome: number,
  filingStatus: FilingStatus
): number {
  return usaTaxes.calculateCapitalGainsTax(capitalGains, otherTaxableIncome, filingStatus);
}

/**
 * Calculate total federal tax on a mix of income types
 */
export function calculateTotalFederalTax(
  ordinaryIncome: number, // Traditional withdrawals, SS, etc.
  capitalGains: number, // Growth portion of taxable account withdrawals
  filingStatus: FilingStatus
): number {
  return usaTaxes.calculateTotalFederalTax(ordinaryIncome, capitalGains, filingStatus);
}

/**
 * Calculate state tax (simplified flat rate)
 */
export function calculateStateTax(
  taxableIncome: number,
  stateTaxRate: number
): number {
  return Math.max(0, taxableIncome) * stateTaxRate;
}
