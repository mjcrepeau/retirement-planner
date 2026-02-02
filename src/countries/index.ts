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

export interface ContributionLimits {
  [key: string]: number | { percentage?: number; max?: number; annual?: number; lifetime?: number };
}

export interface ConversionRule {
  fromAccountType: string;
  toAccountType: string;
  triggerAge: number;
  description: string;
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
   * Calculate federal/national tax on income
   * @param income - Total taxable income for the year
   * @param filingStatus - Optional filing status (US only: 'single', 'married_filing_jointly')
   * @returns Total federal tax owed
   */
  calculateFederalTax: (income: number, filingStatus?: string) => number;

  /**
   * Calculate regional (state/provincial) tax on income
   * @param income - Total taxable income for the year
   * @param regionCode - State or province code
   * @returns Total regional tax owed
   */
  calculateRegionalTax: (income: number, regionCode: string) => number;

  /**
   * Calculate tax on capital gains
   * @param gains - Total capital gains for the year
   * @param ordinaryIncome - Ordinary income (affects brackets)
   * @param regionCode - State or province code
   * @param filingStatus - Optional filing status (US only)
   * @returns Total tax on capital gains
   */
  calculateCapitalGainsTax: (
    gains: number,
    ordinaryIncome: number,
    regionCode: string,
    filingStatus?: string
  ) => number;

  /**
   * Get list of regions (states/provinces) for this country
   */
  getRegions: () => Region[];

  /**
   * Calculate government retirement benefits (Social Security, CPP, OAS, etc.)
   * @param profile - User profile with benefit start ages and amounts
   * @param currentAge - Current age in the simulation
   * @param grossIncome - Gross income for the year (for clawback calculations)
   * @returns Array of benefit calculations (e.g., CPP and OAS for Canada)
   */
  calculateRetirementBenefits: (
    profile: Profile,
    currentAge: number,
    grossIncome: number
  ) => BenefitCalculation[];

  /**
   * Get minimum required withdrawal for an account type at a given age
   * @param age - Current age
   * @param balance - Account balance
   * @param accountType - Type of account
   * @returns Minimum withdrawal amount (0 if no requirement)
   */
  getMinimumWithdrawal: (age: number, balance: number, accountType: string) => number;

  /**
   * Get any mandatory account type conversions (e.g., RRSP -> RRIF at 71)
   */
  getMandatoryConversions: () => ConversionRule[];

  /**
   * Get default profile values for this country
   */
  getDefaultProfile: () => Partial<Profile>;

  /**
   * Get contribution limits for various account types
   */
  getContributionLimits: () => ContributionLimits;

  /**
   * Get withdrawal priority order for tax optimization
   * Returns account types in order of withdrawal preference
   */
  getWithdrawalOrder: () => string[];

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
