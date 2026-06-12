import type { CountryConfig, AccountTypeConfig, Region, AccountGroup, PenaltyInfo } from '../index';
import type { Profile } from '../../types';
import { calculateFederalIncomeTax, calculateProvincialIncomeTax } from './taxes';
import { calculateCanadianRetirementBenefits } from './benefits';
import { calculateRRIFMinimum } from './withdrawals';
import {
  CANADIAN_PROVINCES,
  CPP_MAX_MONTHLY,
  OAS_MAX_MONTHLY,
  FEDERAL_BASIC_PERSONAL_AMOUNT,
  FEDERAL_TAX_BRACKETS,
  CAPITAL_GAINS_INCLUSION_RATE_DEFAULT,
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
    description: 'First Home Savings Account. Modeled as a registered account: unused funds are assumed to transfer to an RRSP and are fully taxable on withdrawal',
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

  calculateYearlyTaxes: (
    ordinaryIncome: number,
    capitalGains: number,
    profile: Profile
  ): { federalTax: number; regionalTax: number } => {
    // Capital gains are included in taxable income at a flat 50% inclusion
    // rate and stack on top of ordinary income.
    const taxableCapitalGains = Math.max(0, capitalGains) * CAPITAL_GAINS_INCLUSION_RATE_DEFAULT;
    const taxableIncome = ordinaryIncome + taxableCapitalGains;

    // Federal and provincial brackets each apply their own basic personal
    // amount exactly once against the combined taxable income.
    const federalTax = calculateFederalIncomeTax(taxableIncome);
    const regionalTax = calculateProvincialIncomeTax(taxableIncome, profile.region || '');

    return { federalTax, regionalTax };
  },

  getGovernmentBenefitTaxableRate: (): number => {
    // CPP and OAS are fully taxable in Canada
    return 1.0;
  },

  getLowBracketFillTarget: (): number => {
    // Federal basic personal amount + top of the first federal tax bracket
    return FEDERAL_BASIC_PERSONAL_AMOUNT + FEDERAL_TAX_BRACKETS[0].max;
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

  getDefaultProfile: () => ({
    country: 'CA' as const,
    currentAge: 35,
    retirementAge: 65,
    lifeExpectancy: 90,
    region: 'ON', // Ontario as default
    socialSecurityBenefit: CPP_MAX_MONTHLY * 12, // CPP (using SS field)
    socialSecurityStartAge: 65,
    secondaryBenefitStartAge: 65, // OAS
    secondaryBenefitAmount: OAS_MAX_MONTHLY * 12,
  }),

  getAccountTypeLabel: (accountType: string): string => {
    const config = CANADA_ACCOUNT_TYPES.find(a => a.type === accountType);
    return config?.label || accountType;
  },

  isTraditionalAccount: (accountType: string): boolean => {
    // FHSA: unused funds are assumed to transfer to an RRSP and are taxed
    // on withdrawal, so we treat it like a registered/traditional account.
    return ['rrsp', 'rrif', 'lira', 'lif', 'employer_rrsp', 'fhsa'].includes(accountType);
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
