import type { Profile } from '../../types';
import type { BenefitCalculation } from '../index';
import {
  CPP_MAX_MONTHLY,
  CPP_START_AGE_DEFAULT,
  CPP_EARLY_REDUCTION_RATE,
  CPP_LATE_INCREASE_RATE,
  OAS_MAX_MONTHLY,
  OAS_START_AGE_DEFAULT,
  OAS_DEFERRAL_INCREASE_RATE,
  OAS_CLAWBACK_THRESHOLD,
  OAS_CLAWBACK_RATE,
  OAS_CLAWBACK_ELIMINATION,
} from './constants';

/**
 * Calculate CPP benefit based on start age
 * @param startAge - Age when CPP starts (60-70)
 * @param baseMonthlyAmount - Base CPP amount at age 65
 * @returns Adjusted monthly CPP amount
 */
export function calculateCPPAdjustment(
  startAge: number,
  baseMonthlyAmount: number = CPP_MAX_MONTHLY
): number {
  const monthsFromAge65 = (startAge - CPP_START_AGE_DEFAULT) * 12;

  if (monthsFromAge65 < 0) {
    // Early start: reduce by 0.6% per month
    const reductionFactor = 1 + (monthsFromAge65 * CPP_EARLY_REDUCTION_RATE);
    return baseMonthlyAmount * reductionFactor;
  } else if (monthsFromAge65 > 0) {
    // Late start: increase by 0.7% per month (up to age 70)
    const increaseFactor = 1 + (monthsFromAge65 * CPP_LATE_INCREASE_RATE);
    return baseMonthlyAmount * increaseFactor;
  }

  return baseMonthlyAmount;
}

/**
 * Calculate OAS benefit based on start age
 * @param startAge - Age when OAS starts (65-70)
 * @param baseMonthlyAmount - Base OAS amount at age 65
 * @returns Adjusted monthly OAS amount
 */
export function calculateOASAdjustment(
  startAge: number,
  baseMonthlyAmount: number = OAS_MAX_MONTHLY
): number {
  if (startAge < 65) return 0; // OAS not available before 65

  const monthsDeferred = (startAge - OAS_START_AGE_DEFAULT) * 12;

  if (monthsDeferred > 0) {
    // Deferral: increase by 0.6% per month
    const increaseFactor = 1 + (monthsDeferred * OAS_DEFERRAL_INCREASE_RATE);
    return baseMonthlyAmount * increaseFactor;
  }

  return baseMonthlyAmount;
}

/**
 * Calculate OAS clawback (recovery tax).
 *
 * All amounts are in TODAY'S dollars: the threshold constants are
 * current-year figures, so the income being tested and the OAS amount must
 * be deflated to today's dollars before calling. (The clawback threshold is
 * indexed to inflation in law, so comparing deflated income against the
 * current threshold is equivalent to indexing the threshold.)
 *
 * @param netIncome - Prior-year taxable income in today's dollars
 * @param oasAmount - Annual OAS in today's dollars
 * @returns Amount of OAS that must be repaid, in today's dollars
 */
export function calculateOASClawback(netIncome: number, oasAmount: number): number {
  if (netIncome <= OAS_CLAWBACK_THRESHOLD) return 0;
  if (netIncome >= OAS_CLAWBACK_ELIMINATION) return oasAmount;

  const excessIncome = netIncome - OAS_CLAWBACK_THRESHOLD;
  const clawback = excessIncome * OAS_CLAWBACK_RATE;

  return Math.min(clawback, oasAmount);
}

/**
 * Calculate CPP and OAS benefits for a given year.
 *
 * Returns amounts in today's dollars; the engine inflates them afterwards.
 *
 * @param meansTestIncome - Prior-year taxable income in TODAY'S dollars,
 *   used for the OAS clawback. Passing nominal future-year income here
 *   would overstate the clawback badly for long horizons.
 */
export function calculateCanadianRetirementBenefits(
  profile: Profile,
  currentAge: number,
  meansTestIncome: number
): BenefitCalculation[] {
  const benefits: BenefitCalculation[] = [];

  // CPP Calculation
  // Using socialSecurityBenefit and socialSecurityStartAge as CPP fields
  if (
    profile.socialSecurityBenefit &&
    profile.socialSecurityStartAge &&
    currentAge >= profile.socialSecurityStartAge
  ) {
    const cppStartAge = profile.socialSecurityStartAge;
    const baseMonthly = profile.socialSecurityBenefit / 12; // Assume stored as annual
    const adjustedMonthly = calculateCPPAdjustment(cppStartAge, baseMonthly);

    benefits.push({
      age: currentAge,
      monthlyAmount: adjustedMonthly,
      annualAmount: adjustedMonthly * 12,
    });
  }

  // OAS Calculation
  // Using secondaryBenefitStartAge and secondaryBenefitAmount for OAS
  const oasStartAge = profile.secondaryBenefitStartAge || OAS_START_AGE_DEFAULT;
  const oasBaseMonthly = profile.secondaryBenefitAmount
    ? profile.secondaryBenefitAmount / 12
    : OAS_MAX_MONTHLY;

  if (currentAge >= oasStartAge) {
    const adjustedOASMonthly = calculateOASAdjustment(oasStartAge, oasBaseMonthly);
    const annualOAS = adjustedOASMonthly * 12;

    // Calculate clawback
    const clawback = calculateOASClawback(meansTestIncome, annualOAS);
    const netOAS = annualOAS - clawback;

    if (netOAS > 0) {
      benefits.push({
        age: currentAge,
        monthlyAmount: netOAS / 12,
        annualAmount: netOAS,
      });
    }
  }

  return benefits;
}
