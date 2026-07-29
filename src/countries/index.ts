import type { Profile } from '../types';

export type CountryCode = 'US' | 'CA';

export interface Region {
  code: string;
  name: string;
  taxRate?: number; // Optional flat tax rate (some regions use complex brackets)
}

export interface AccountTypeConfig {
  type: string;
  label: string;
  taxTreatment: 'pretax' | 'roth' | 'taxable' | 'hsa';
  description?: string;
}

export interface BenefitCalculation {
  age: number;
  monthlyAmount: number;
  annualAmount: number;
}

export interface PenaltyInfo {
  penaltyAge: number;              // Age when penalty no longer applies (e.g., 59.5 for US)
  penaltyRate: number;             // Penalty rate as decimal (e.g., 0.10 for 10%)
  appliesToAccountType: boolean;   // Does this account type have early withdrawal penalties?
}

/**
 * AccountGroup defines how accounts are grouped for display purposes
 * This allows each country to define meaningful groupings for their account types
 */
export interface AccountGroup {
  id: string;
  label: string;
  color: string;
  accountTypes: string[]; // List of account type codes that belong to this group
  description?: string;
}

/**
 * CountryConfig defines the interface that each country module must implement
 * This allows the retirement calculator to work with different tax systems,
 * account types, and government benefits in a pluggable way.
 */
export interface CountryConfig {
  /** Two-letter country code */
  code: CountryCode;

  /** Full country name */
  name: string;

  /** Flag emoji */
  flag: string;

  /** Currency code (USD, CAD, etc.) */
  currency: string;

  /** Available account types in this country */
  accountTypes: AccountTypeConfig[];

  /**
   * Calculate the year's total federal/national and regional/provincial taxes
   * on a combination of ordinary income and capital gains.
   *
   * Implementations should apply their own rules for how capital gains
   * stack on ordinary income, inclusion/exclusion rates, standard
   * deductions / basic personal amounts, and regional tax treatment.
   *
   * @param ordinaryIncome - Total ordinary taxable income for the year (nominal dollars)
   * @param capitalGains - Total (pre-inclusion) capital gains for the year (nominal dollars)
   * @param profile - User profile (filing status, region, state tax rate, etc.)
   * @param indexFactor - Cumulative inflation multiplier for the simulated
   *   year; scales brackets/deductions/personal amounts, which are indexed to
   *   inflation under current law. Defaults to 1 (current tax year).
   * @returns Federal/national tax, regional/provincial tax, and the taxable
   *   income used (ordinary income plus the included portion of capital
   *   gains, before deductions) — callers use it for benefit means-testing.
   */
  calculateYearlyTaxes: (
    ordinaryIncome: number,
    capitalGains: number,
    profile: Profile,
    indexFactor?: number
  ) => { federalTax: number; regionalTax: number; taxableIncome: number };

  /**
   * Get the portion of government retirement benefit income (e.g., Social
   * Security, CPP/OAS) that counts as taxable income.
   *
   * This flat rate is used as a planning ESTIMATE (e.g., in the
   * bracket-fill step, before the year's withdrawals are known). The exact
   * amount is computed afterwards by getTaxableGovernmentBenefits.
   *
   * @returns Taxable rate as a decimal (e.g., 0.85 for US Social Security, 1.0 for Canada CPP/OAS)
   */
  getGovernmentBenefitTaxableRate: () => number;

  /**
   * Compute the exact taxable amount of retirement-benefit income for the
   * year, once all other income is known.
   *
   * @param governmentBenefitIncome - Government benefits from the profile
   *   (US Social Security, Canada CPP/OAS), nominal dollars
   * @param ssStreamIncome - Income-stream income with the social_security
   *   tax treatment, nominal dollars
   * @param otherOrdinaryIncome - All other income counted when means-testing
   *   benefit taxability (traditional withdrawals, pensions, other income,
   *   capital gains), nominal dollars
   * @param profile - User profile (filing status)
   * @returns Total taxable income arising from both benefit pools
   */
  getTaxableGovernmentBenefits: (
    governmentBenefitIncome: number,
    ssStreamIncome: number,
    otherOrdinaryIncome: number,
    profile: Profile
  ) => number;

  /**
   * Get the total ordinary income (in dollars) up to which additional
   * traditional account withdrawals are considered tax-efficient
   * ("fill the low bracket" step of the withdrawal strategy).
   * @param filingStatus - Optional filing status (US only)
   * @returns Total ordinary income target for the low-bracket-fill step
   */
  getLowBracketFillTarget: (filingStatus?: string) => number;

  /**
   * Get list of regions (states/provinces) for this country
   */
  getRegions: () => Region[];

  /**
   * Calculate government retirement benefits (Social Security, CPP, OAS, etc.)
   *
   * Benefit amounts are returned in today's dollars; the engine applies the
   * inflation multiplier afterwards.
   *
   * @param profile - User profile with benefit start ages and amounts
   * @param currentAge - Current age in the simulation
   * @param meansTestIncome - Prior-year taxable income for means-testing
   *   (e.g., OAS clawback), expressed in TODAY'S dollars so it compares
   *   against current-year thresholds in like units
   * @returns Array of benefit calculations (e.g., CPP and OAS for Canada)
   */
  calculateRetirementBenefits: (
    profile: Profile,
    currentAge: number,
    meansTestIncome: number
  ) => BenefitCalculation[];

  /**
   * Get minimum required withdrawal for an account type at a given age
   * @param age - Current age
   * @param balance - Account balance
   * @param accountType - Type of account
   * @param birthYear - Birth year, for rules where the start age depends on
   *   it (US SECURE 2.0: RMDs at 73 if born before 1960, 75 otherwise).
   *   When omitted, the earliest start age applies.
   * @returns Minimum withdrawal amount (0 if no requirement)
   */
  getMinimumWithdrawal: (
    age: number,
    balance: number,
    accountType: string,
    birthYear?: number
  ) => number;

  /**
   * Age at which mandatory minimum withdrawals (RMD/RRIF) begin for
   * traditional accounts, for a person born in `birthYear`.
   * US: 73 (born before 1960) or 75 (born 1960+); Canada: 71.
   */
  getRMDStartAge: (birthYear: number) => number;

  /**
   * Get default profile values for this country
   */
  getDefaultProfile: () => Partial<Profile>;

  /**
   * Get label for account type
   */
  getAccountTypeLabel: (accountType: string) => string;

  /**
   * Check if account type is traditional (pretax)
   */
  isTraditionalAccount: (accountType: string) => boolean;

  /**
   * Check if account type supports employer matching
   */
  supportsEmployerMatch: (accountType: string) => boolean;

  /**
   * Get account groupings for display purposes
   * Returns groups that define how accounts should be organized in charts and summaries
   */
  getAccountGroupings: () => AccountGroup[];

  /**
   * Get penalty information for an account type
   * @param accountType - The account type to check
   * @returns Penalty info including age, rate, and whether it applies
   */
  getPenaltyInfo: (accountType: string) => PenaltyInfo;

  /**
   * Calculate early withdrawal penalty amount
   * @param amount - Withdrawal amount
   * @param accountType - Type of account
   * @param age - Current age
   * @returns Penalty amount in dollars
   */
  calculateEarlyWithdrawalPenalty: (
    amount: number,
    accountType: string,
    age: number
  ) => number;
}

/**
 * Country registry - maps country codes to their configurations
 */
const countryRegistry: Map<CountryCode, CountryConfig> = new Map();

/**
 * Register a country configuration
 */
export function registerCountry(config: CountryConfig): void {
  countryRegistry.set(config.code, config);
}

/**
 * Get a country configuration by code
 */
export function getCountryConfig(code: CountryCode): CountryConfig {
  const config = countryRegistry.get(code);
  if (!config) {
    throw new Error(`Country configuration not found for: ${code}`);
  }
  return config;
}

/**
 * Get all available country codes
 */
export function getAvailableCountries(): CountryCode[] {
  return Array.from(countryRegistry.keys());
}

/**
 * Get all registered country configurations
 */
export function getAllCountryConfigs(): CountryConfig[] {
  return Array.from(countryRegistry.values());
}

// Import and register countries
import { USConfig } from './usa';
import { CAConfig } from './canada';

// Register countries on module load
registerCountry(USConfig);
registerCountry(CAConfig);
