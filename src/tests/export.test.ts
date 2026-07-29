/**
 * Export Feature Tests
 *
 * Covers scenario save/load round-tripping and validation, CSV serialization,
 * and the nominal -> real conversion used by the exports.
 *
 * Run with: npx tsx src/tests/export.test.ts
 */

import { Account, Assumptions, IncomeStream, Profile } from '../types';
import { getCountryConfig } from '../countries';
import { calculateAccumulation } from '../utils/projections';
import { calculateWithdrawals } from '../utils/withdrawals';
import { inflationFactor, presentValue } from '../utils/export/realDollars';
import { csvFilename, toCsv } from '../utils/export/csv';
import {
  buildAccumulationTable,
  buildExportMeta,
  buildWithdrawalTable,
} from '../utils/export/tables';
import {
  SCENARIO_SCHEMA_VERSION,
  buildScenario,
  parseScenario,
  scenarioFilename,
} from '../utils/export/scenario';
import type { ExportTable } from '../utils/export/types';

// Test utilities
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ ${message}`);
    failedTests++;
  }
}

function assertApprox(actual: number, expected: number, tolerance: number, message: string): void {
  const diff = Math.abs(actual - expected);
  if (diff <= tolerance) {
    console.log(`  ✓ ${message} (got ${actual.toFixed(2)}, expected ${expected.toFixed(2)})`);
    passedTests++;
  } else {
    console.error(`  ✗ ${message} (got ${actual.toFixed(2)}, expected ${expected.toFixed(2)}, diff: ${diff.toFixed(2)})`);
    failedTests++;
  }
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual === expected) {
    console.log(`  ✓ ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ ${message} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`);
    failedTests++;
  }
}

function section(name: string): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${name}`);
  console.log('='.repeat(60));
}

// =============================================================================
// Fixtures
// =============================================================================

const usConfig = getCountryConfig('US');

const testAccounts: Account[] = [
  {
    id: 'acc-401k',
    name: 'Company 401(k)',
    type: 'traditional_401k',
    balance: 150000,
    annualContribution: 15000,
    contributionGrowthRate: 0.03,
    returnRate: 0.07,
    employerMatchPercent: 0.5,
    employerMatchLimit: 3000,
    withdrawalRules: { startAge: 60 },
  },
  {
    id: 'acc-roth',
    name: 'Roth IRA',
    type: 'roth_ira',
    balance: 40000,
    annualContribution: 7000,
    contributionGrowthRate: 0,
    returnRate: 0.07,
    withdrawalRules: { startAge: 60 },
  },
];

const testProfile: Profile = {
  country: 'US',
  currentAge: 35,
  retirementAge: 65,
  lifeExpectancy: 90,
  region: 'CA',
  filingStatus: 'married_filing_jointly',
  stateTaxRate: 0.05,
};

const testAssumptions: Assumptions = {
  inflationRate: 0.03,
  safeWithdrawalRate: 0.04,
  retirementReturnRate: 0.05,
};

const testIncomeStreams: IncomeStream[] = [
  {
    id: 'stream-ss',
    name: 'Social Security',
    monthlyAmount: 2500,
    startAge: 67,
    taxTreatment: 'social_security',
  },
];

const FIXED_DATE = new Date('2026-07-29T12:00:00.000Z');

const accumulation = calculateAccumulation(testAccounts, testProfile, usConfig);
const retirement = calculateWithdrawals(
  testAccounts,
  testProfile,
  testAssumptions,
  accumulation,
  usConfig,
  testIncomeStreams
);
const meta = buildExportMeta(testProfile, testAssumptions, 'US', FIXED_DATE);

/** Split a CSV into its data block and its trailing metadata block. */
function splitCsv(csv: string): { header: string; body: string[]; metaLines: string[] } {
  const lines = csv.replace(/^\uFEFF/, '').split('\r\n');
  const blankIndex = lines.indexOf('');
  const dataLines = lines.slice(0, blankIndex);
  return {
    header: dataLines[0],
    body: dataLines.slice(1),
    metaLines: lines.slice(blankIndex + 1).filter(line => line.length > 0),
  };
}

// =============================================================================
// REAL DOLLARS
// =============================================================================

function testRealDollars(): void {
  section('NOMINAL VS REAL CONVERSION');

  assertEqual(inflationFactor(0, 0.03), 1, 'Inflation factor is 1 at year 0');
  assertEqual(inflationFactor(-5, 0.03), 1, 'Inflation factor is 1 for past years');
  assertApprox(inflationFactor(25, 0.03), 2.0938, 0.001, '25 years at 3% compounds to ~2.094x');
  assertApprox(inflationFactor(30, 0), 1, 0.0001, 'Zero inflation never deflates');

  assertApprox(
    presentValue(1_000_000, 25, 0.03),
    477_605.57,
    1,
    '$1M in 25 years is ~$478k today at 3%'
  );
  assertEqual(presentValue(50_000, 0, 0.03), 50_000, 'Present value at year 0 is unchanged');

  // Round trip
  const nominal = 123_456.78;
  assertApprox(
    presentValue(nominal, 12, 0.025) * inflationFactor(12, 0.025),
    nominal,
    0.01,
    'Deflating then reinflating returns the original amount'
  );
}

// =============================================================================
// CSV SERIALIZATION
// =============================================================================

function testCsvEscaping(): void {
  section('CSV ESCAPING');

  const trickyAccounts: Account[] = [
    { ...testAccounts[0], id: 'a1', name: 'Smith, John "Jr"' },
    { ...testAccounts[1], id: 'a2', name: '=HYPERLINK("http://evil","click")' },
  ];
  const trickyAccumulation = calculateAccumulation(trickyAccounts, testProfile, usConfig);
  const table = buildAccumulationTable('balances', trickyAccounts, trickyAccumulation, meta);
  const { header } = splitCsv(toCsv(table));

  assert(
    header.includes('"Smith, John ""Jr"""'),
    'Commas and quotes in account names are escaped'
  );
  assert(
    header.includes(`"'=HYPERLINK`),
    'Formula-leading account names are neutralized with an apostrophe'
  );

  // Newlines
  const newlineTable: ExportTable = {
    id: 'test',
    title: 'Test',
    columns: [{ key: 'note', label: 'Note', type: 'text' }],
    rows: [{ note: 'line one\nline two' }],
    meta,
  };
  const { body } = splitCsv(toCsv(newlineTable));
  assert(
    body[0].startsWith('"line one'),
    'Embedded newlines are quoted rather than breaking the row'
  );
}

function testCsvStructure(): void {
  section('CSV STRUCTURE');

  const table = buildAccumulationTable('summary', testAccounts, accumulation, meta);
  const csv = toCsv(table);

  assert(csv.startsWith('\uFEFF'), 'CSV starts with a UTF-8 BOM for Excel');
  assert(csv.includes('\r\n'), 'CSV uses CRLF line endings (RFC 4180)');

  const { header, body, metaLines } = splitCsv(csv);
  assertEqual(
    header,
    'Age,Year,Total Balance,Total Balance (Real),Year Growth,Total Contributions,Total Contributions (Real),Inflation Factor',
    'Header row is the first line, so spreadsheets auto-detect it'
  );
  assertEqual(
    body.length,
    accumulation.yearlyBalances.length,
    'One data row per projected year'
  );
  assert(
    metaLines.every(line => line.startsWith('#')),
    'Metadata lines come after a blank line and are all comment-prefixed'
  );
  assert(
    metaLines.some(line => line.includes('Inflation rate') && line.includes('3.00%')),
    'Metadata records the inflation rate used'
  );
  assert(
    metaLines.some(line => line.includes('bracket creep')),
    'Metadata warns that nominal tax figures include bracket creep'
  );

  assertEqual(
    csvFilename(table),
    'retirement-planner-accumulation-summary-2026-07-29.csv',
    'Filename includes the table id and generation date'
  );
}

function testCsvNumbersAreRaw(): void {
  section('CSV NUMERIC OUTPUT');

  const table = buildAccumulationTable('summary', testAccounts, accumulation, meta);
  const { body } = splitCsv(toCsv(table));
  const firstRow = body[0].split(',');

  assert(!body[0].includes('$'), 'Money values carry no currency symbol');
  assert(
    !body[0].includes('"'),
    'Numeric rows need no quoting — no formatted values sneak in'
  );
  assert(
    firstRow.every(field => field === '' || Number.isFinite(Number(field))),
    'Every field in a data row parses as a number (spreadsheets treat them as numeric)'
  );
  assertEqual(firstRow[0], '35', 'First row is the current age');
  assertApprox(
    Number(firstRow[2]),
    190000,
    1,
    'Year 0 total balance matches the starting balances'
  );
  assertEqual(firstRow[4], '', 'Year 0 growth is blank rather than a bogus zero');
}

function testRealColumnsMatchNominal(): void {
  section('REAL COLUMNS');

  const table = buildAccumulationTable('summary', testAccounts, accumulation, meta);

  const lastRow = table.rows[table.rows.length - 1];
  const years = (lastRow.age as number) - testProfile.currentAge;
  const expectedFactor = inflationFactor(years, testAssumptions.inflationRate);

  assertApprox(
    lastRow.inflationFactor as number,
    expectedFactor,
    0.0001,
    'Inflation Factor column equals (1 + i)^(age - current age)'
  );
  assertApprox(
    (lastRow.totalBalance as number) / (lastRow.inflationFactor as number),
    lastRow.totalBalanceReal as number,
    0.01,
    'Nominal divided by the inflation factor equals the Real column'
  );
  assert(
    (lastRow.totalBalanceReal as number) < (lastRow.totalBalance as number),
    'Real balance is smaller than nominal in a positive-inflation world'
  );

  const firstRow = table.rows[0];
  assertEqual(firstRow.inflationFactor, 1, 'Current year has an inflation factor of 1');
  assertEqual(
    firstRow.totalBalance,
    firstRow.totalBalanceReal,
    'Nominal and real agree in the base year'
  );
}

function testTableCoverage(): void {
  section('TABLE BUILDERS');

  const accumulationIds = ['summary', 'balances', 'contributions'] as const;
  accumulationIds.forEach(id => {
    const table = buildAccumulationTable(id, testAccounts, accumulation, meta);
    assert(table.rows.length > 0, `Accumulation "${id}" table has rows`);
    assert(table.columns.length > 0, `Accumulation "${id}" table has columns`);
    const csv = toCsv(table);
    const { header, body } = splitCsv(csv);
    assertEqual(
      header.split(',').length >= table.columns.length,
      true,
      `Accumulation "${id}" header covers every column`
    );
    assertEqual(
      body.length,
      table.rows.length + (table.footer ? 1 : 0),
      `Accumulation "${id}" writes every row (plus footer when present)`
    );
  });

  const withdrawalIds = ['income', 'withdrawals', 'balances', 'taxes', 'incomeStreams'] as const;
  withdrawalIds.forEach(id => {
    const table = buildWithdrawalTable(id, testAccounts, retirement, testIncomeStreams, meta);
    assert(table.rows.length > 0, `Retirement "${id}" table has rows`);
    const { body } = splitCsv(toCsv(table));
    assertEqual(
      body.length,
      table.rows.length + (table.footer ? 1 : 0),
      `Retirement "${id}" writes every row (plus footer when present)`
    );
  });
}

function testFooterTotals(): void {
  section('FOOTER TOTALS');

  const taxTable = buildWithdrawalTable('taxes', testAccounts, retirement, testIncomeStreams, meta);
  assert(!!taxTable.footer, 'Tax table has a lifetime totals footer');

  const summedTax = taxTable.rows.reduce((sum, row) => sum + (row.totalTax as number), 0);
  assertApprox(
    taxTable.footer!.totalTax as number,
    summedTax,
    1,
    'Footer total tax equals the sum of the yearly rows'
  );
  assertApprox(
    taxTable.footer!.totalTax as number,
    retirement.lifetimeTaxesPaid,
    1,
    'Footer total tax matches the engine lifetime figure'
  );

  const contributionsTable = buildAccumulationTable(
    'contributions',
    testAccounts,
    accumulation,
    meta
  );
  const summedContributions = contributionsTable.rows.reduce(
    (sum, row) => sum + (row.total as number),
    0
  );
  assertApprox(
    contributionsTable.footer!.total as number,
    summedContributions,
    1,
    'Contributions footer equals the sum of the yearly totals'
  );
}

function testEmployerMatchColumns(): void {
  section('EMPLOYER MATCH COLUMNS');

  const table = buildAccumulationTable('contributions', testAccounts, accumulation, meta);
  const labels = table.columns.map(column => column.label);

  assert(
    labels.includes('Company 401(k) (Employer Match)'),
    'Matching accounts get a dedicated employer match column'
  );
  assert(
    !labels.includes('Roth IRA (Employer Match)'),
    'Non-matching accounts get no match column'
  );

  // Match is capped at the configured limit.
  const lastRow = table.rows[table.rows.length - 1];
  assert(
    (lastRow['acc-401k:match'] as number) <= 3000,
    'Employer match respects the configured dollar limit'
  );

  // Canadian employer RRSPs match too — this used to be missed by the table.
  const caConfig = getCountryConfig('CA');
  const caProfile: Profile = { ...testProfile, country: 'CA', region: 'ON' };
  const caAccounts: Account[] = [
    {
      id: 'acc-rrsp',
      name: 'Employer RRSP',
      type: 'employer_rrsp',
      balance: 150000,
      annualContribution: 15000,
      contributionGrowthRate: 0.03,
      returnRate: 0.07,
      employerMatchPercent: 0.5,
      employerMatchLimit: 3000,
      withdrawalRules: { startAge: 65 },
    },
  ];
  const caAccumulation = calculateAccumulation(caAccounts, caProfile, caConfig);
  const caMeta = buildExportMeta(caProfile, testAssumptions, 'CA', FIXED_DATE);
  const caTable = buildAccumulationTable('contributions', caAccounts, caAccumulation, caMeta);

  assert(
    caTable.columns.some(column => column.label === 'Employer RRSP (Employer Match)'),
    'Employer RRSP match is reported, matching the projection engine'
  );
  assertApprox(
    caTable.rows[0]['acc-rrsp:match'] as number,
    3000,
    0.01,
    'Employer RRSP match is capped at the limit (50% of $15k > $3k)'
  );
}

function testRegionalTaxLabel(): void {
  section('COUNTRY-AWARE LABELS');

  const usTable = buildWithdrawalTable('taxes', testAccounts, retirement, testIncomeStreams, meta);
  assert(
    usTable.columns.some(column => column.label === 'State Tax'),
    'US tax table labels the regional column "State Tax"'
  );

  const caMeta = buildExportMeta(
    { ...testProfile, country: 'CA', region: 'ON' },
    testAssumptions,
    'CA',
    FIXED_DATE
  );
  const caTable = buildWithdrawalTable(
    'taxes',
    testAccounts,
    retirement,
    testIncomeStreams,
    caMeta
  );
  assert(
    caTable.columns.some(column => column.label === 'Provincial Tax'),
    'Canadian tax table labels the regional column "Provincial Tax"'
  );
  assertEqual(caMeta.currency, 'CAD', 'Canadian exports are denominated in CAD');
}

// =============================================================================
// SCENARIO SAVE / LOAD
// =============================================================================

function testScenarioRoundTrip(): void {
  section('SCENARIO ROUND TRIP');

  const scenario = buildScenario(
    {
      country: 'US',
      profile: testProfile,
      accounts: testAccounts,
      incomeStreams: testIncomeStreams,
      assumptions: testAssumptions,
    },
    FIXED_DATE
  );

  assertEqual(scenario.app, 'retirement-planner', 'Scenario is stamped with the app id');
  assertEqual(
    scenario.schemaVersion,
    SCENARIO_SCHEMA_VERSION,
    'Scenario carries the current schema version'
  );
  assertEqual(
    scenarioFilename(FIXED_DATE),
    'retirement-plan-2026-07-29.json',
    'Scenario filename is dated'
  );

  const result = parseScenario(JSON.stringify(scenario));
  if (!result.ok) {
    assert(false, `Round trip parses cleanly (error: ${result.error})`);
    return;
  }

  assert(true, 'Round trip parses cleanly');
  assertEqual(
    JSON.stringify(result.scenario.accounts),
    JSON.stringify(testAccounts),
    'Accounts survive the round trip unchanged'
  );
  assertEqual(
    JSON.stringify(result.scenario.assumptions),
    JSON.stringify(testAssumptions),
    'Assumptions survive the round trip unchanged'
  );
  assertEqual(
    JSON.stringify(result.scenario.incomeStreams),
    JSON.stringify(testIncomeStreams),
    'Income streams survive the round trip unchanged'
  );
  assertEqual(
    result.scenario.profile.currentAge,
    testProfile.currentAge,
    'Profile survives the round trip'
  );

  // Projections from the reloaded scenario must match the original.
  const reloaded = calculateAccumulation(result.scenario.accounts, result.scenario.profile, usConfig);
  assertApprox(
    reloaded.totalAtRetirement,
    accumulation.totalAtRetirement,
    0.01,
    'Reloaded scenario reproduces the same projection'
  );
}

function testScenarioDropsUnknownFields(): void {
  section('SCENARIO SANITIZATION');

  const withJunk = {
    app: 'retirement-planner',
    schemaVersion: 1,
    exportedAt: FIXED_DATE.toISOString(),
    country: 'US',
    profile: { ...testProfile, injected: 'nope' },
    accounts: [{ ...testAccounts[0], injected: 'nope' }],
    incomeStreams: [],
    assumptions: testAssumptions,
    somethingElse: { deeply: 'nested' },
  };

  const result = parseScenario(JSON.stringify(withJunk));
  if (!result.ok) {
    assert(false, `Junk-bearing file still parses (error: ${result.error})`);
    return;
  }

  assert(
    !('injected' in result.scenario.accounts[0]),
    'Unknown account fields are dropped rather than written to storage'
  );
  assert(
    !('injected' in result.scenario.profile),
    'Unknown profile fields are dropped rather than written to storage'
  );
  assert(
    !('somethingElse' in result.scenario),
    'Unknown top-level fields are dropped'
  );
}

function testScenarioValidation(): void {
  section('SCENARIO VALIDATION');

  const base = {
    app: 'retirement-planner',
    schemaVersion: 1,
    exportedAt: FIXED_DATE.toISOString(),
    country: 'US',
    profile: testProfile,
    accounts: testAccounts,
    incomeStreams: testIncomeStreams,
    assumptions: testAssumptions,
  };

  const expectFailure = (payload: unknown, description: string, expectedFragment?: string) => {
    const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const result = parseScenario(text);
    if (result.ok) {
      assert(false, `${description} is rejected`);
      return;
    }
    if (expectedFragment && !result.error.toLowerCase().includes(expectedFragment.toLowerCase())) {
      assert(false, `${description} is rejected with a useful message (got: "${result.error}")`);
      return;
    }
    assert(true, `${description} is rejected — "${result.error}"`);
  };

  expectFailure('not json at all', 'Malformed JSON', 'valid JSON');
  expectFailure('[1,2,3]', 'A JSON array');
  expectFailure({ ...base, app: 'some-other-app' }, 'A file from another app', 'Retirement Planner');
  expectFailure(
    { ...base, schemaVersion: SCENARIO_SCHEMA_VERSION + 1 },
    'A file from a newer version',
    'newer version'
  );
  expectFailure({ ...base, schemaVersion: 0 }, 'An unrecognized schema version');
  expectFailure({ ...base, country: 'UK' }, 'An unsupported country', 'country');
  expectFailure({ ...base, profile: undefined }, 'A missing profile', 'profile');
  expectFailure({ ...base, assumptions: undefined }, 'Missing assumptions', 'assumptions');
  expectFailure({ ...base, accounts: 'lots' }, 'A non-list accounts field', 'accounts');
  expectFailure(
    { ...base, accounts: [{ ...testAccounts[0], type: 'crypto_wallet' }] },
    'An unrecognized account type',
    'account type'
  );
  expectFailure(
    { ...base, accounts: [{ ...testAccounts[0], balance: 'a lot' }] },
    'A non-numeric balance',
    'balance'
  );
  expectFailure(
    { ...base, accounts: [{ ...testAccounts[0], balance: null }] },
    'A null balance'
  );
  expectFailure(
    { ...base, profile: { ...testProfile, currentAge: 'thirty-five' } },
    'A non-numeric age',
    'currentAge'
  );
  expectFailure(
    { ...base, profile: { ...testProfile, filingStatus: 'its_complicated' } },
    'An invalid filing status',
    'filingStatus'
  );
  expectFailure(
    { ...base, incomeStreams: [{ ...testIncomeStreams[0], taxTreatment: 'lottery' }] },
    'An unrecognized income tax treatment',
    'taxTreatment'
  );
  expectFailure(
    { ...base, assumptions: { ...testAssumptions, inflationRate: Infinity } },
    'A non-finite assumption',
    'inflationRate'
  );

  // An older-but-supported version is accepted.
  const okResult = parseScenario(JSON.stringify({ ...base, schemaVersion: 1 }));
  assert(okResult.ok, 'A file at the current schema version is accepted');

  // Accounts saved before withdrawal rules existed still load.
  const legacyAccount = { ...testAccounts[0] };
  delete (legacyAccount as Partial<Account>).withdrawalRules;
  const legacyResult = parseScenario(JSON.stringify({ ...base, accounts: [legacyAccount] }));
  if (legacyResult.ok) {
    assertEqual(
      legacyResult.scenario.accounts[0].withdrawalRules,
      undefined,
      'Accounts without withdrawal rules load (the app normalizes them on read)'
    );
  } else {
    assert(false, `Legacy accounts load (error: ${legacyResult.error})`);
  }
}

function testScenarioCountrySwitch(): void {
  section('SCENARIO COUNTRY HANDLING');

  const caScenario = {
    app: 'retirement-planner',
    schemaVersion: 1,
    exportedAt: FIXED_DATE.toISOString(),
    country: 'CA',
    // A profile whose stored country disagrees with the file's country.
    profile: { ...testProfile, country: 'US' },
    accounts: [
      {
        id: 'acc-tfsa',
        name: 'TFSA',
        type: 'tfsa',
        balance: 40000,
        annualContribution: 7000,
        contributionGrowthRate: 0,
        returnRate: 0.07,
      },
    ],
    incomeStreams: [],
    assumptions: testAssumptions,
  };

  const result = parseScenario(JSON.stringify(caScenario));
  if (!result.ok) {
    assert(false, `Canadian scenario parses (error: ${result.error})`);
    return;
  }

  assertEqual(result.scenario.country, 'CA', 'File-level country is preserved');
  assertEqual(
    result.scenario.profile.country,
    'CA',
    'Profile country is forced to match the file, so account types stay valid'
  );
}

// =============================================================================
// RUN
// =============================================================================

function runAllTests(): void {
  console.log('\n' + '█'.repeat(60));
  console.log('EXPORT FEATURE TEST SUITE');
  console.log('█'.repeat(60));

  testRealDollars();
  testCsvEscaping();
  testCsvStructure();
  testCsvNumbersAreRaw();
  testRealColumnsMatchNominal();
  testTableCoverage();
  testFooterTotals();
  testEmployerMatchColumns();
  testRegionalTaxLabel();
  testScenarioRoundTrip();
  testScenarioDropsUnknownFields();
  testScenarioValidation();
  testScenarioCountrySwitch();

  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`  ✓ Passed: ${passedTests}`);
  console.log(`  ✗ Failed: ${failedTests}`);
  console.log(`  Total: ${passedTests + failedTests}`);
  console.log('='.repeat(60) + '\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests();
