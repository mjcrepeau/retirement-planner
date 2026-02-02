import type { CountryConfig, AccountTypeConfig, Region, ConversionRule, ContributionLimits, AccountGroup, PenaltyInfo } from '../index';
import type { Profile } from '../../types';
import { calculateFederalIncomeTax, calculateProvincialIncomeTax, calculateTotalTax } from './taxes';
import { calculateCanadianRetirementBenefits } from './benefits';
import { calculateRRIFMinimum } from './withdrawals';
import {
  CANADIAN_PROVINCES,
  RRSP_CONTRIBUTION_RATE,
  RRSP_CONTRIBUTION_MAX,
  TFSA_ANNUAL_LIMIT,
  FHSA_ANNUAL_LIMIT,
  FHSA_LIFETIME_LIMIT,
  RRIF_START_AGE,
  CPP_MAX_MONTHLY,
  OAS_MAX_MONTHLY,
} from './constants';
import { CHART_COLORS } from '../../utils/constants';

const CANADA_ACCOUNT_TYPES: AccountTypeConfig[] = [
  {
    type: 'rrsp',
    label: 'RRSP',
    taxTreatment: 'pretax',
    description: 'Registered Retirement Savings Plan (pre-tax contributions)',
  },
  {
    type: 'tfsa',
    label: 'TFSA',
    taxTreatment: 'roth',
    description: 'Tax-Free Savings Account (tax-free growth and withdrawals)',
  },
  {
    type: 'rrif',
    label: 'RRIF',
    taxTreatment: 'pretax',
    description: 'Registered Retirement Income Fund (converted from RRSP)',
  },
  {
    type: 'lira',
    label: 'LIRA',
    taxTreatment: 'pretax',
    description: 'Locked-In Retirement Account (from pension transfers)',
  },
  {
    type: 'lif',
    label: 'LIF',
    taxTreatment: 'pretax',
    description: 'Life Income Fund (converted from LIRA)',
  },
  {
    type: 'fhsa',
    label: 'FHSA',
    taxTreatment: 'pretax',
    description: 'First Home Savings Account (for home purchase)',
  },
  {
    type: 'non_registered',
    label: 'Non-Registered',
    taxTreatment: 'taxable',
    description: 'Taxable investment account (capital gains treatment)',
  },
  {
    type: 'employer_rrsp',
    label: 'Employer RRSP',
    taxTreatment: 'pretax',
    description: 'RRSP with employer matching',
  },
];

// Withdrawal priority for Canada tax optimization
const CANADA_WITHDRAWAL_ORDER = [
  'rrif',              // RRIF minimums first (mandatory)
  'rrsp',              // Then RRSP if not yet converted
  'non_registered',    // Taxable (favorable cap gains treatment)
  'lif',               // LIF (locked-in, special rules)
  'lira',              // LIRA
  'fhsa',              // FHSA
  'employer_rrsp',     // Employer RRSP
  'tfsa',              // TFSA last (preserve tax-free growth)
];

// Account groupings for display purposes
const CANADA_ACCOUNT_GROUPS: AccountGroup[] = [
  {
    id: 'rrsp_rrif',
    label: 'RRSP/RRIF',
    color: CHART_COLORS.pretax,
    accountTypes: ['rrsp', 'rrif', 'employer_rrsp'],
    description: 'Tax-deferred retirement savings (RRSP converts to RRIF at 71)',
  },
  {
    id: 'tfsa',
    label: 'TFSA',
    color: CHART_COLORS.roth,
    accountTypes: ['tfsa'],
    description: 'Tax-Free Savings Account (tax-free growth and withdrawals)',
  },
  {
    id: 'lira_lif',
    label: 'LIRA/LIF',
    color: '#6366f1', // indigo - different from RRSP
    accountTypes: ['lira', 'lif'],
    description: 'Locked-in retirement accounts (from pension transfers)',
  },
  {
    id: 'fhsa',
    label: 'FHSA',
    color: '#8b5cf6', // purple
    accountTypes: ['fhsa'],
    description: 'First Home Savings Account',
  },
  {
    id: 'non_registered',
    label: 'Non-Registered',
    color: CHART_COLORS.taxable,
    accountTypes: ['non_registered'],
    description: 'Taxable investment accounts',
  },
];

export const CAConfig: CountryConfig = {
  code: 'CA',
  name: 'Canada',
  flag: '🇨🇦',
  currency: 'CAD',
  accountTypes: CANADA_ACCOUNT_TYPES,

  calculateFederalTax: (income: number, _filingStatus?: string) => {
    return calculateFederalIncomeTax(income);
  },

  calculateRegionalTax: (income: number, regionCode: string) => {
    return calculateProvincialIncomeTax(income, regionCode);
  },

  calculateCapitalGainsTax: (
    gains: number,
    _ordinaryIncome: number,
    regionCode: string,
    _filingStatus?: string
  ) => {
    // In Canada, capital gains are added to income and taxed at marginal rates
    // The calculateTotalTax function handles the inclusion rate
    return calculateTotalTax(0, gains, regionCode);
  },

  getRegions: (): Region[] => {
    return CANADIAN_PROVINCES;
  },

  calculateRetirementBenefits: (profile: Profile, currentAge: number, grossIncome: number) => {
    return calculateCanadianRetirementBenefits(profile, currentAge, grossIncome);
  },

  getMinimumWithdrawal: (age: number, balance: number, accountType: string) => {
    return calculateRRIFMinimum(age, balance, accountType);
  },

  getMandatoryConversions: (): ConversionRule[] => {
    return [
      {
        fromAccountType: 'rrsp',
        toAccountType: 'rrif',
        triggerAge: RRIF_START_AGE,
        description: 'RRSP must be converted to RRIF by December 31 of the year you turn 71',
      },
    ];
  },

  getDefaultProfile: () => ({
    currentAge: 35,
    retirementAge: 65,
    lifeExpectancy: 90,
    region: 'ON', // Ontario as default
    annualIncome: 75000, // For RRSP contribution room calculation
    socialSecurityBenefit: CPP_MAX_MONTHLY * 12, // CPP (using SS field)
    socialSecurityStartAge: 65,
    secondaryBenefitStartAge: 65, // OAS
    secondaryBenefitAmount: OAS_MAX_MONTHLY * 12,
  }),

  getContributionLimits: (): ContributionLimits => ({
    rrsp: { percentage: RRSP_CONTRIBUTION_RATE, max: RRSP_CONTRIBUTION_MAX },
    tfsa: TFSA_ANNUAL_LIMIT,
    fhsa: { annual: FHSA_ANNUAL_LIMIT, lifetime: FHSA_LIFETIME_LIMIT },
    employer_rrsp: { percentage: RRSP_CONTRIBUTION_RATE, max: RRSP_CONTRIBUTION_MAX },
  }),

  getWithdrawalOrder: () => CANADA_WITHDRAWAL_ORDER,

  getAccountTypeLabel: (accountType: string): string => {
    const config = CANADA_ACCOUNT_TYPES.find(a => a.type === accountType);
    return config?.label || accountType;
  },

  isTraditionalAccount: (accountType: string): boolean => {
    return ['rrsp', 'rrif', 'lira', 'lif', 'employer_rrsp'].includes(accountType);
  },

  supportsEmployerMatch: (accountType: string): boolean => {
    return accountType === 'employer_rrsp';
  },

  getAccountGroupings: (): AccountGroup[] => {
    return CANADA_ACCOUNT_GROUPS;
  },

  getPenaltyInfo: (_accountType: string): PenaltyInfo => {
    // Canada does not have early withdrawal penalties like the US
    // Withholding tax is handled separately in tax calculations
    return {
      penaltyAge: 0,
      penaltyRate: 0,
      appliesToAccountType: false,
    };
  },

  calculateEarlyWithdrawalPenalty: (
    _amount: number,
    _accountType: string,
    _age: number
  ): number => {
    // Canada does not have early withdrawal penalties
    // Withholding tax is handled separately in tax calculations
    return 0;
  },
};
