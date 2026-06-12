import type { TaxBracket } from '../../types';

// The tax year these Canadian federal/provincial constants reflect. Update
// this alongside the brackets/amounts below when refreshing to a new tax
// year. All jurisdictions, including Quebec (QC) and Yukon (YT), reflect
// this year.
export const TAX_DATA_YEAR = 2026;

// 2026 Federal Tax Brackets (Canada)
// The lowest federal rate dropped from 15% to 14.5% (mid-2025) and to 14%
// for 2026 and later years.
export const FEDERAL_TAX_BRACKETS: TaxBracket[] = [
  { min: 0, max: 58523, rate: 0.14 },
  { min: 58523, max: 117045, rate: 0.205 },
  { min: 117045, max: 181440, rate: 0.26 },
  { min: 181440, max: 258482, rate: 0.29 },
  { min: 258482, max: Infinity, rate: 0.33 },
];

// 2026 Basic Personal Amount (Federal, maximum amount)
export const FEDERAL_BASIC_PERSONAL_AMOUNT = 16452;

// Provincial/Territorial Tax Brackets and Basic Personal Amounts
// 2026 values for all jurisdictions, including Quebec (QC) and Yukon (YT).

export const PROVINCIAL_TAX_BRACKETS: Record<string, TaxBracket[]> = {
  AB: [ // Alberta (2026)
    { min: 0, max: 61200, rate: 0.08 },
    { min: 61200, max: 154259, rate: 0.10 },
    { min: 154259, max: 185111, rate: 0.12 },
    { min: 185111, max: 246813, rate: 0.13 },
    { min: 246813, max: 370220, rate: 0.14 },
    { min: 370220, max: Infinity, rate: 0.15 },
  ],
  BC: [ // British Columbia (2026)
    { min: 0, max: 50363, rate: 0.056 },
    { min: 50363, max: 100728, rate: 0.077 },
    { min: 100728, max: 115648, rate: 0.105 },
    { min: 115648, max: 140430, rate: 0.1229 },
    { min: 140430, max: 190405, rate: 0.147 },
    { min: 190405, max: 265545, rate: 0.168 },
    { min: 265545, max: Infinity, rate: 0.205 },
  ],
  MB: [ // Manitoba (2026 - indexation frozen since 2025, same as 2024)
    { min: 0, max: 47000, rate: 0.108 },
    { min: 47000, max: 100000, rate: 0.1275 },
    { min: 100000, max: Infinity, rate: 0.174 },
  ],
  NB: [ // New Brunswick (2026)
    { min: 0, max: 52333, rate: 0.094 },
    { min: 52333, max: 104666, rate: 0.14 },
    { min: 104666, max: 193861, rate: 0.16 },
    { min: 193861, max: Infinity, rate: 0.195 },
  ],
  NL: [ // Newfoundland and Labrador (2026)
    { min: 0, max: 44678, rate: 0.087 },
    { min: 44678, max: 89354, rate: 0.145 },
    { min: 89354, max: 159528, rate: 0.158 },
    { min: 159528, max: 223340, rate: 0.178 },
    { min: 223340, max: 285319, rate: 0.198 },
    { min: 285319, max: 570638, rate: 0.208 },
    { min: 570638, max: 1141275, rate: 0.213 },
    { min: 1141275, max: Infinity, rate: 0.218 },
  ],
  NS: [ // Nova Scotia (2026)
    { min: 0, max: 30995, rate: 0.0879 },
    { min: 30995, max: 61991, rate: 0.1495 },
    { min: 61991, max: 97417, rate: 0.1667 },
    { min: 97417, max: 157124, rate: 0.175 },
    { min: 157124, max: Infinity, rate: 0.21 },
  ],
  NT: [ // Northwest Territories (2026)
    { min: 0, max: 53003, rate: 0.059 },
    { min: 53003, max: 106009, rate: 0.086 },
    { min: 106009, max: 172346, rate: 0.122 },
    { min: 172346, max: Infinity, rate: 0.1405 },
  ],
  NU: [ // Nunavut (2026)
    { min: 0, max: 55801, rate: 0.04 },
    { min: 55801, max: 111602, rate: 0.07 },
    { min: 111602, max: 181439, rate: 0.09 },
    { min: 181439, max: Infinity, rate: 0.115 },
  ],
  ON: [ // Ontario (2026)
    { min: 0, max: 53891, rate: 0.0505 },
    { min: 53891, max: 107785, rate: 0.0915 },
    { min: 107785, max: 150000, rate: 0.1116 },
    { min: 150000, max: 220000, rate: 0.1216 },
    { min: 220000, max: Infinity, rate: 0.1316 },
  ],
  PE: [ // Prince Edward Island (2026)
    { min: 0, max: 33928, rate: 0.095 },
    { min: 33928, max: 65820, rate: 0.1347 },
    { min: 65820, max: 106890, rate: 0.166 },
    { min: 106890, max: 142250, rate: 0.1762 },
    { min: 142250, max: Infinity, rate: 0.19 },
  ],
  QC: [ // Quebec (simplified - QC has its own tax system) (2026)
    { min: 0, max: 54345, rate: 0.14 },
    { min: 54345, max: 108680, rate: 0.19 },
    { min: 108680, max: 132245, rate: 0.24 },
    { min: 132245, max: Infinity, rate: 0.2575 },
  ],
  SK: [ // Saskatchewan (2026)
    { min: 0, max: 54532, rate: 0.105 },
    { min: 54532, max: 155805, rate: 0.125 },
    { min: 155805, max: Infinity, rate: 0.145 },
  ],
  YT: [ // Yukon (2026 - mirrors federal brackets for first three tiers)
    { min: 0, max: 58523, rate: 0.064 },
    { min: 58523, max: 117045, rate: 0.09 },
    { min: 117045, max: 181440, rate: 0.109 },
    { min: 181440, max: 500000, rate: 0.128 },
    { min: 500000, max: Infinity, rate: 0.15 },
  ],
};

export const PROVINCIAL_BASIC_PERSONAL_AMOUNTS: Record<string, number> = {
  AB: 22769, // 2026
  BC: 13216, // 2026
  MB: 15780, // 2026 (frozen since 2025, same as 2024)
  NB: 13664, // 2026
  NL: 13094, // 2026
  NS: 11932, // 2026
  NT: 18198, // 2026
  NU: 19659, // 2026
  ON: 12989, // 2026
  PE: 15000, // 2026
  QC: 18952, // 2026
  SK: 20381, // 2026
  YT: 16452, // 2026 (mirrors federal Basic Personal Amount)
};

// Canadian Provinces and Territories
export const CANADIAN_PROVINCES = [
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'NT', name: 'Northwest Territories' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'ON', name: 'Ontario' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'QC', name: 'Quebec' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'YT', name: 'Yukon' },
];

// RRIF Minimum Withdrawal Percentages (set by ITA regulation; unchanged since 2015)
export const RRIF_START_AGE = 71; // Must convert RRSP to RRIF by end of year turning 71

export interface RRIFEntry {
  age: number;
  minimumPercentage: number;
}

export const RRIF_MINIMUM_TABLE: RRIFEntry[] = [
  { age: 71, minimumPercentage: 0.0528 },
  { age: 72, minimumPercentage: 0.0540 },
  { age: 73, minimumPercentage: 0.0553 },
  { age: 74, minimumPercentage: 0.0567 },
  { age: 75, minimumPercentage: 0.0582 },
  { age: 76, minimumPercentage: 0.0598 },
  { age: 77, minimumPercentage: 0.0617 },
  { age: 78, minimumPercentage: 0.0636 },
  { age: 79, minimumPercentage: 0.0658 },
  { age: 80, minimumPercentage: 0.0682 },
  { age: 81, minimumPercentage: 0.0708 },
  { age: 82, minimumPercentage: 0.0738 },
  { age: 83, minimumPercentage: 0.0771 },
  { age: 84, minimumPercentage: 0.0808 },
  { age: 85, minimumPercentage: 0.0851 },
  { age: 86, minimumPercentage: 0.0899 },
  { age: 87, minimumPercentage: 0.0955 },
  { age: 88, minimumPercentage: 0.1021 },
  { age: 89, minimumPercentage: 0.1099 },
  { age: 90, minimumPercentage: 0.1192 },
  { age: 91, minimumPercentage: 0.1306 },
  { age: 92, minimumPercentage: 0.1449 },
  { age: 93, minimumPercentage: 0.1634 },
  { age: 94, minimumPercentage: 0.1879 },
  { age: 95, minimumPercentage: 0.20 },
];

// CPP (Canada Pension Plan) Constants (2026)
export const CPP_MAX_MONTHLY = 1507.65; // At age 65
export const CPP_START_AGE_MIN = 60;
export const CPP_START_AGE_MAX = 70;
export const CPP_START_AGE_DEFAULT = 65;
export const CPP_EARLY_REDUCTION_RATE = 0.006; // 0.6% per month
export const CPP_LATE_INCREASE_RATE = 0.007; // 0.7% per month

// OAS (Old Age Security) Constants (2026)
export const OAS_MAX_MONTHLY = 742.31; // At age 65 (ages 65-74)
export const OAS_START_AGE_MIN = 65;
export const OAS_START_AGE_MAX = 70;
export const OAS_START_AGE_DEFAULT = 65;
export const OAS_DEFERRAL_INCREASE_RATE = 0.006; // 0.6% per month
export const OAS_CLAWBACK_THRESHOLD = 95323; // 2026 threshold
export const OAS_CLAWBACK_RATE = 0.15; // 15% recovery tax
export const OAS_CLAWBACK_ELIMINATION = 154708; // Full elimination threshold (ages 65-74)

// Capital Gains Inclusion Rate
// The proposed increase to 66.67% for gains over $250k was deferred and
// ultimately cancelled in 2025; a flat 50% inclusion rate applies.
export const CAPITAL_GAINS_INCLUSION_RATE_DEFAULT = 0.50; // 50% of gains are taxable
