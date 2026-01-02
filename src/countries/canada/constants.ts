import type { TaxBracket } from '../../types';

// 2024 Federal Tax Brackets (Canada)
export const FEDERAL_TAX_BRACKETS: TaxBracket[] = [
  { min: 0, max: 55867, rate: 0.15 },
  { min: 55867, max: 111733, rate: 0.205 },
  { min: 111733, max: 173205, rate: 0.26 },
  { min: 173205, max: 246752, rate: 0.29 },
  { min: 246752, max: Infinity, rate: 0.33 },
];

// 2024 Basic Personal Amount (Federal)
export const FEDERAL_BASIC_PERSONAL_AMOUNT = 15705;

// Provincial/Territorial Tax Brackets and Basic Personal Amounts (2024)

export const PROVINCIAL_TAX_BRACKETS: Record<string, TaxBracket[]> = {
  AB: [ // Alberta
    { min: 0, max: 148269, rate: 0.10 },
    { min: 148269, max: 177922, rate: 0.12 },
    { min: 177922, max: 237230, rate: 0.13 },
    { min: 237230, max: 355845, rate: 0.14 },
    { min: 355845, max: Infinity, rate: 0.15 },
  ],
  BC: [ // British Columbia
    { min: 0, max: 47937, rate: 0.0506 },
    { min: 47937, max: 95875, rate: 0.077 },
    { min: 95875, max: 110076, rate: 0.105 },
    { min: 110076, max: 133664, rate: 0.1229 },
    { min: 133664, max: 181232, rate: 0.147 },
    { min: 181232, max: 252752, rate: 0.168 },
    { min: 252752, max: Infinity, rate: 0.205 },
  ],
  MB: [ // Manitoba
    { min: 0, max: 47000, rate: 0.108 },
    { min: 47000, max: 100000, rate: 0.1275 },
    { min: 100000, max: Infinity, rate: 0.174 },
  ],
  NB: [ // New Brunswick
    { min: 0, max: 49958, rate: 0.094 },
    { min: 49958, max: 99916, rate: 0.14 },
    { min: 99916, max: 185064, rate: 0.16 },
    { min: 185064, max: Infinity, rate: 0.195 },
  ],
  NL: [ // Newfoundland and Labrador
    { min: 0, max: 43198, rate: 0.087 },
    { min: 43198, max: 86395, rate: 0.145 },
    { min: 86395, max: 154244, rate: 0.158 },
    { min: 154244, max: 215943, rate: 0.178 },
    { min: 215943, max: Infinity, rate: 0.208 },
  ],
  NS: [ // Nova Scotia
    { min: 0, max: 29590, rate: 0.0879 },
    { min: 29590, max: 59180, rate: 0.1495 },
    { min: 59180, max: 93000, rate: 0.1667 },
    { min: 93000, max: 150000, rate: 0.175 },
    { min: 150000, max: Infinity, rate: 0.21 },
  ],
  NT: [ // Northwest Territories
    { min: 0, max: 50597, rate: 0.059 },
    { min: 50597, max: 101198, rate: 0.086 },
    { min: 101198, max: 164525, rate: 0.122 },
    { min: 164525, max: Infinity, rate: 0.1405 },
  ],
  NU: [ // Nunavut
    { min: 0, max: 53268, rate: 0.04 },
    { min: 53268, max: 106537, rate: 0.07 },
    { min: 106537, max: 173205, rate: 0.09 },
    { min: 173205, max: Infinity, rate: 0.115 },
  ],
  ON: [ // Ontario
    { min: 0, max: 51446, rate: 0.0505 },
    { min: 51446, max: 102894, rate: 0.0915 },
    { min: 102894, max: 150000, rate: 0.1116 },
    { min: 150000, max: 220000, rate: 0.1216 },
    { min: 220000, max: Infinity, rate: 0.1316 },
  ],
  PE: [ // Prince Edward Island
    { min: 0, max: 32656, rate: 0.098 },
    { min: 32656, max: 64313, rate: 0.138 },
    { min: 64313, max: 105000, rate: 0.167 },
    { min: 105000, max: Infinity, rate: 0.187 },
  ],
  QC: [ // Quebec (simplified - QC has its own tax system)
    { min: 0, max: 51780, rate: 0.14 },
    { min: 51780, max: 103545, rate: 0.19 },
    { min: 103545, max: 126000, rate: 0.24 },
    { min: 126000, max: Infinity, rate: 0.2575 },
  ],
  SK: [ // Saskatchewan
    { min: 0, max: 52057, rate: 0.105 },
    { min: 52057, max: 148734, rate: 0.125 },
    { min: 148734, max: Infinity, rate: 0.145 },
  ],
  YT: [ // Yukon
    { min: 0, max: 55867, rate: 0.064 },
    { min: 55867, max: 111733, rate: 0.09 },
    { min: 111733, max: 173205, rate: 0.109 },
    { min: 173205, max: 500000, rate: 0.128 },
    { min: 500000, max: Infinity, rate: 0.15 },
  ],
};

export const PROVINCIAL_BASIC_PERSONAL_AMOUNTS: Record<string, number> = {
  AB: 21885,
  BC: 12580,
  MB: 15780,
  NB: 13044,
  NL: 10382,
  NS: 8481,
  NT: 16593,
  NU: 19000,
  ON: 11865,
  PE: 13500,
  QC: 18056,
  SK: 18491,
  YT: 15705,
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

// RRIF Minimum Withdrawal Percentages (2024)
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

// CPP (Canada Pension Plan) Constants (2024)
export const CPP_MAX_MONTHLY = 1364.60; // At age 65
export const CPP_START_AGE_MIN = 60;
export const CPP_START_AGE_MAX = 70;
export const CPP_START_AGE_DEFAULT = 65;
export const CPP_EARLY_REDUCTION_RATE = 0.006; // 0.6% per month
export const CPP_LATE_INCREASE_RATE = 0.007; // 0.7% per month

// OAS (Old Age Security) Constants (2024)
export const OAS_MAX_MONTHLY = 713.34; // At age 65
export const OAS_START_AGE_MIN = 65;
export const OAS_START_AGE_MAX = 70;
export const OAS_START_AGE_DEFAULT = 65;
export const OAS_DEFERRAL_INCREASE_RATE = 0.006; // 0.6% per month
export const OAS_CLAWBACK_THRESHOLD = 86912; // 2024 threshold
export const OAS_CLAWBACK_RATE = 0.15; // 15% recovery tax
export const OAS_CLAWBACK_ELIMINATION = 142609; // Full elimination threshold

// Capital Gains Inclusion Rates (2024)
export const CAPITAL_GAINS_INCLUSION_RATE_DEFAULT = 0.50; // 50% of gains are taxable
export const CAPITAL_GAINS_INCLUSION_RATE_HIGH = 0.6667; // 66.67% for gains over $250k
export const CAPITAL_GAINS_THRESHOLD = 250000; // Threshold for higher inclusion rate

// Contribution Limits (2024)
export const RRSP_CONTRIBUTION_RATE = 0.18; // 18% of previous year's income
export const RRSP_CONTRIBUTION_MAX = 31560; // 2024 limit
export const TFSA_ANNUAL_LIMIT = 7000; // 2024 limit
export const FHSA_ANNUAL_LIMIT = 8000; // 2024 limit
export const FHSA_LIFETIME_LIMIT = 40000; // Lifetime limit
