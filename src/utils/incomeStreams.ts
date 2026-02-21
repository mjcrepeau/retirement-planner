import type { IncomeStream, IncomeTaxTreatment } from '../types';

export interface IncomeStreamResult {
  totalIncome: number;
  byTaxTreatment: Record<IncomeTaxTreatment, number>;
}

/**
 * Calculate total income from income streams for a given age.
 * Amounts are in today's dollars — caller applies inflation.
 */
export function calculateIncomeStreamBenefits(
  incomeStreams: IncomeStream[],
  age: number,
): IncomeStreamResult {
  const byTaxTreatment: Record<IncomeTaxTreatment, number> = {
    social_security: 0,
    fully_taxable: 0,
    tax_free: 0,
  };

  let totalIncome = 0;

  for (const stream of incomeStreams) {
    if (age >= stream.startAge) {
      const annualAmount = stream.monthlyAmount * 12;
      totalIncome += annualAmount;
      byTaxTreatment[stream.taxTreatment] += annualAmount;
    }
  }

  return { totalIncome, byTaxTreatment };
}
