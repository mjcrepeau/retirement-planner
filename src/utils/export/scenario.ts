import {
  Account,
  AccountType,
  Assumptions,
  FilingStatus,
  IncomeStream,
  Profile,
  isAccountType,
  isIncomeTaxTreatment,
} from '../../types';
import type { CountryCode } from '../../countries';

export const SCENARIO_APP_ID = 'retirement-planner';
export const SCENARIO_SCHEMA_VERSION = 1;

export interface ScenarioFile {
  app: typeof SCENARIO_APP_ID;
  schemaVersion: number;
  exportedAt: string;
  country: CountryCode;
  profile: Profile;
  accounts: Account[];
  incomeStreams: IncomeStream[];
  assumptions: Assumptions;
}

export type ParseResult =
  | { ok: true; scenario: ScenarioFile }
  | { ok: false; error: string };

interface ScenarioInput {
  country: CountryCode;
  profile: Profile;
  accounts: Account[];
  incomeStreams: IncomeStream[];
  assumptions: Assumptions;
}

export function buildScenario(input: ScenarioInput, now: Date = new Date()): ScenarioFile {
  return {
    app: SCENARIO_APP_ID,
    schemaVersion: SCENARIO_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    country: input.country,
    profile: input.profile,
    accounts: input.accounts,
    incomeStreams: input.incomeStreams,
    assumptions: input.assumptions,
  };
}

export function scenarioFilename(now: Date = new Date()): string {
  return `retirement-plan-${now.toISOString().slice(0, 10)}.json`;
}

// ---------------------------------------------------------------------------
// Validation
//
// Files can be hand-edited or come from another machine, so every field is
// checked and unknown fields are dropped rather than written into localStorage.
// ---------------------------------------------------------------------------

class ValidationError extends Error {}

function fail(message: string): never {
  throw new ValidationError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function num(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`${label} must be a number.`);
  }
  return value;
}

function optionalNum(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  return num(value, label);
}

function str(value: unknown, label: string): string {
  if (typeof value !== 'string') fail(`${label} must be text.`);
  return value;
}

function parseProfile(value: unknown, country: CountryCode): Profile {
  if (!isRecord(value)) fail('The file is missing its "profile" section.');

  const filingStatus = value.filingStatus;
  if (
    filingStatus !== undefined &&
    filingStatus !== 'single' &&
    filingStatus !== 'married_filing_jointly'
  ) {
    fail('profile.filingStatus must be "single" or "married_filing_jointly".');
  }

  return {
    country,
    currentAge: num(value.currentAge, 'profile.currentAge'),
    retirementAge: num(value.retirementAge, 'profile.retirementAge'),
    lifeExpectancy: num(value.lifeExpectancy, 'profile.lifeExpectancy'),
    region: str(value.region, 'profile.region'),
    filingStatus: filingStatus as FilingStatus | undefined,
    stateTaxRate: optionalNum(value.stateTaxRate, 'profile.stateTaxRate'),
    socialSecurityBenefit: optionalNum(
      value.socialSecurityBenefit,
      'profile.socialSecurityBenefit'
    ),
    socialSecurityStartAge: optionalNum(
      value.socialSecurityStartAge,
      'profile.socialSecurityStartAge'
    ),
    secondaryBenefitStartAge: optionalNum(
      value.secondaryBenefitStartAge,
      'profile.secondaryBenefitStartAge'
    ),
    secondaryBenefitAmount: optionalNum(
      value.secondaryBenefitAmount,
      'profile.secondaryBenefitAmount'
    ),
  };
}

function parseAccount(value: unknown, index: number): Account {
  if (!isRecord(value)) fail(`Account #${index + 1} is not valid.`);

  const label = `accounts[${index}]`;
  if (!isAccountType(value.type)) {
    fail(`${label}.type is not a recognized account type ("${String(value.type)}").`);
  }

  const withdrawalRules = value.withdrawalRules;
  let parsedRules: Account['withdrawalRules'];
  if (withdrawalRules !== undefined && withdrawalRules !== null) {
    if (!isRecord(withdrawalRules)) fail(`${label}.withdrawalRules is not valid.`);
    parsedRules = {
      startAge: num(withdrawalRules.startAge, `${label}.withdrawalRules.startAge`),
    };
  }

  return {
    id: str(value.id, `${label}.id`),
    name: str(value.name, `${label}.name`),
    type: value.type as AccountType,
    balance: num(value.balance, `${label}.balance`),
    annualContribution: num(value.annualContribution, `${label}.annualContribution`),
    contributionGrowthRate: num(
      value.contributionGrowthRate,
      `${label}.contributionGrowthRate`
    ),
    returnRate: num(value.returnRate, `${label}.returnRate`),
    employerMatchPercent: optionalNum(
      value.employerMatchPercent,
      `${label}.employerMatchPercent`
    ),
    employerMatchLimit: optionalNum(value.employerMatchLimit, `${label}.employerMatchLimit`),
    withdrawalRules: parsedRules,
    costBasis: optionalNum(value.costBasis, `${label}.costBasis`),
  };
}

function parseIncomeStream(value: unknown, index: number): IncomeStream {
  if (!isRecord(value)) fail(`Income stream #${index + 1} is not valid.`);

  const label = `incomeStreams[${index}]`;
  if (!isIncomeTaxTreatment(value.taxTreatment)) {
    fail(`${label}.taxTreatment is not recognized ("${String(value.taxTreatment)}").`);
  }

  return {
    id: str(value.id, `${label}.id`),
    name: str(value.name, `${label}.name`),
    monthlyAmount: num(value.monthlyAmount, `${label}.monthlyAmount`),
    startAge: num(value.startAge, `${label}.startAge`),
    endAge: optionalNum(value.endAge, `${label}.endAge`),
    taxTreatment: value.taxTreatment,
  };
}

function parseAssumptions(value: unknown): Assumptions {
  if (!isRecord(value)) fail('The file is missing its "assumptions" section.');
  return {
    inflationRate: num(value.inflationRate, 'assumptions.inflationRate'),
    safeWithdrawalRate: num(value.safeWithdrawalRate, 'assumptions.safeWithdrawalRate'),
    retirementReturnRate: num(
      value.retirementReturnRate,
      'assumptions.retirementReturnRate'
    ),
  };
}

export function parseScenario(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }

  try {
    if (!isRecord(raw)) fail('The file does not contain a saved plan.');

    if (raw.app !== SCENARIO_APP_ID) {
      fail("That file wasn't saved by Retirement Planner.");
    }

    const schemaVersion = num(raw.schemaVersion, 'schemaVersion');
    if (schemaVersion > SCENARIO_SCHEMA_VERSION) {
      fail(
        `That file was saved by a newer version of Retirement Planner (format v${schemaVersion}; this version reads up to v${SCENARIO_SCHEMA_VERSION}).`
      );
    }
    if (schemaVersion < 1) {
      fail(`Unrecognized file format version (v${schemaVersion}).`);
    }

    if (raw.country !== 'US' && raw.country !== 'CA') {
      fail('The file does not specify a supported country (expected "US" or "CA").');
    }
    const country: CountryCode = raw.country;

    if (!Array.isArray(raw.accounts)) fail('The file is missing its "accounts" list.');
    if (!Array.isArray(raw.incomeStreams)) {
      fail('The file is missing its "incomeStreams" list.');
    }

    const scenario: ScenarioFile = {
      app: SCENARIO_APP_ID,
      schemaVersion,
      exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
      country,
      profile: parseProfile(raw.profile, country),
      accounts: raw.accounts.map(parseAccount),
      incomeStreams: raw.incomeStreams.map(parseIncomeStream),
      assumptions: parseAssumptions(raw.assumptions),
    };

    return { ok: true, scenario };
  } catch (error) {
    if (error instanceof ValidationError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: 'That file could not be read as a saved plan.' };
  }
}
