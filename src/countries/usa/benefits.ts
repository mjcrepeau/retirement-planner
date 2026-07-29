import type { Profile } from '../../types';
import type { BenefitCalculation } from '../index';

/**
 * Calculate Social Security benefits
 * Simplified: assumes benefit starts at specified age with specified amount
 * In reality, Social Security has complex early/late claiming adjustments
 */
export function calculateSocialSecurityBenefits(
  profile: Profile,
  currentAge: number,
  _grossIncome: number // Not used for SS, but part of the interface
): BenefitCalculation[] {
  const benefits: BenefitCalculation[] = [];

  // Check if Social Security has started
  if (
    profile.socialSecurityBenefit &&
    profile.socialSecurityStartAge &&
    currentAge >= profile.socialSecurityStartAge
  ) {
    const annualBenefit = profile.socialSecurityBenefit;
    benefits.push({
      age: currentAge,
      monthlyAmount: annualBenefit / 12,
      annualAmount: annualBenefit,
    });
  }

  return benefits;
}

// The taxable portion of Social Security is computed by
// calculateTaxableSocialSecurity in ./taxes.ts (provisional-income phase-in).
