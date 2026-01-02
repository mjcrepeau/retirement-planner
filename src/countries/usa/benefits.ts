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

/**
 * Calculate taxable portion of Social Security
 * US has up to 85% of SS taxable depending on income
 * Simplified: assumes 85% taxable
 */
export function getTaxableSocialSecurity(socialSecurityBenefit: number): number {
  return socialSecurityBenefit * 0.85;
}
