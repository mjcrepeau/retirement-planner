import {
  Account,
  AccumulationResult,
  Assumptions,
  IncomeStream,
  Profile,
  RetirementResult,
} from '../types';
import type { CountryCode } from '../countries';
import { TAX_DATA_YEAR } from '../utils/constants';
import {
  buildAccountsTable,
  buildAccumulationTable,
  buildExportMeta,
  buildIncomeStreamsTable,
  buildWithdrawalTable,
  formatCell,
} from '../utils/export';
import type { ExportTable } from '../utils/export';
import { SummaryCards } from './SummaryCards';
import { MethodologyPanel } from './MethodologyPanel';
import { ChartAccumulation } from './ChartAccumulation';
import { ChartComposition } from './ChartComposition';
import { ChartDrawdown } from './ChartDrawdown';
import { ChartIncome } from './ChartIncome';
import { ChartTax } from './ChartTax';

interface PrintReportProps {
  accounts: Account[];
  profile: Profile;
  assumptions: Assumptions;
  incomeStreams: IncomeStream[];
  accumulation: AccumulationResult;
  retirement: RetirementResult;
  country: CountryCode;
  generatedAt: Date;
}

function PrintTable({ table }: { table: ExportTable }) {
  const { currency } = table.meta;

  return (
    <div className="print-block mb-6">
      <h3 className="text-base font-semibold text-gray-900 mb-2">{table.title}</h3>
      <table className="w-full text-[10px] border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-400">
            {table.columns.map(column => (
              <th
                key={column.key}
                className={`py-1 px-1 font-semibold text-gray-800 ${
                  column.type === 'text' ? 'text-left' : 'text-right'
                }`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, index) => (
            <tr key={index} className="border-b border-gray-200">
              {table.columns.map(column => (
                <td
                  key={column.key}
                  className={`py-0.5 px-1 text-gray-700 ${
                    column.type === 'text' ? 'text-left' : 'text-right tabular-nums'
                  }`}
                >
                  {formatCell(row[column.key], column.type, currency)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {table.footer && (
          <tfoot>
            <tr className="border-t-2 border-gray-400 font-semibold">
              {table.columns.map(column => (
                <td
                  key={column.key}
                  className={`py-1 px-1 text-gray-900 ${
                    column.type === 'text' ? 'text-left' : 'text-right tabular-nums'
                  }`}
                >
                  {formatCell(table.footer![column.key], column.type, currency)}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="print-section">
      <h2 className="text-lg font-bold text-gray-900 border-b-2 border-gray-800 pb-1 mb-4">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1 border-b border-gray-200 text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-gray-900 tabular-nums">{value}</span>
    </div>
  );
}

export function PrintReport({
  accounts,
  profile,
  assumptions,
  incomeStreams,
  accumulation,
  retirement,
  country,
  generatedAt,
}: PrintReportProps) {
  const meta = buildExportMeta(profile, assumptions, country, generatedAt);
  const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

  const dateLabel = generatedAt.toLocaleDateString(country === 'CA' ? 'en-CA' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    // Charts measure their container, so the report is laid out at a fixed
    // 720px (7.5in at 96dpi) both off-screen and on paper.
    <div className="print-report bg-white text-gray-900">
      {/* Cover */}
      <header className="print-block mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Retirement Plan</h1>
        <p className="text-sm text-gray-600 mt-1">
          Generated {dateLabel} · {country === 'CA' ? 'Canada' : 'United States'} ·{' '}
          {meta.currency}
        </p>
        <p className="text-xs text-gray-500 mt-4 border border-gray-300 rounded p-3 leading-relaxed">
          <strong>Dollar amounts are nominal (future) dollars</strong> unless labelled
          &ldquo;real&rdquo; or &ldquo;today&rsquo;s dollars&rdquo;. Nominal figures include{' '}
          {percent(assumptions.inflationRate)} annual inflation, so later years look larger
          than their purchasing power. Tax brackets are not indexed to inflation in this
          model ({TAX_DATA_YEAR} brackets are held constant), which overstates the tax
          burden in later years. This report provides estimates only — consult a financial
          advisor for personalized advice.
        </p>
      </header>

      <Section title="Plan Inputs">
        <div className="grid grid-cols-2 gap-x-8 mb-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-1">Profile</h3>
            <Field label="Current age" value={String(profile.currentAge)} />
            <Field label="Retirement age" value={String(profile.retirementAge)} />
            <Field label="Life expectancy" value={String(profile.lifeExpectancy)} />
            <Field label={country === 'CA' ? 'Province' : 'State'} value={profile.region} />
            {profile.filingStatus && (
              <Field
                label="Filing status"
                value={
                  profile.filingStatus === 'married_filing_jointly'
                    ? 'Married filing jointly'
                    : 'Single'
                }
              />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-1">Assumptions</h3>
            <Field label="Inflation" value={percent(assumptions.inflationRate)} />
            <Field
              label="Safe withdrawal rate"
              value={percent(assumptions.safeWithdrawalRate)}
            />
            <Field
              label="Retirement return"
              value={percent(assumptions.retirementReturnRate)}
            />
          </div>
        </div>

        <PrintTable table={buildAccountsTable(accounts, meta)} />
        {incomeStreams.length > 0 && (
          <PrintTable table={buildIncomeStreamsTable(incomeStreams, meta)} />
        )}
      </Section>

      <Section title="Summary">
        {/* SummaryCards lays out up to 4 columns at the `md` breakpoint, which
            keys off the viewport rather than this 720px container. See the
            .print-summary rule in index.css. */}
        <div className="print-summary">
          <SummaryCards
            profile={profile}
            assumptions={assumptions}
            accumulationResult={accumulation}
            retirementResult={retirement}
          />
        </div>
        <div className="print-block mt-6">
          <h3 className="text-base font-semibold text-gray-900 mb-2">
            Portfolio Composition at Retirement
          </h3>
          <ChartComposition accounts={accounts} result={accumulation} isDarkMode={false} animate={false} />
        </div>
      </Section>

      <Section title="Accumulation Phase">
        <div className="print-block mb-6">
          <h3 className="text-base font-semibold text-gray-900 mb-2">
            Account Growth (Age {profile.currentAge} to {profile.retirementAge})
          </h3>
          <ChartAccumulation accounts={accounts} result={accumulation} isDarkMode={false} animate={false} />
        </div>
        <PrintTable table={buildAccumulationTable('summary', accounts, accumulation, meta)} />
      </Section>

      <Section title="Retirement Phase">
        <div className="print-block mb-6">
          <h3 className="text-base font-semibold text-gray-900 mb-2">
            Portfolio Drawdown (Age {profile.retirementAge} to {profile.lifeExpectancy})
          </h3>
          <ChartDrawdown accounts={accounts} result={retirement} isDarkMode={false} animate={false} />
        </div>
        <div className="print-block mb-6">
          <h3 className="text-base font-semibold text-gray-900 mb-2">
            Annual Retirement Income
          </h3>
          <ChartIncome result={retirement} incomeStreams={incomeStreams} isDarkMode={false} animate={false} />
        </div>
        <PrintTable
          table={buildWithdrawalTable('income', accounts, retirement, incomeStreams, meta)}
        />
      </Section>

      <Section title="Taxes">
        <div className="print-block mb-6">
          <h3 className="text-base font-semibold text-gray-900 mb-2">Tax Burden Over Time</h3>
          <ChartTax result={retirement} isDarkMode={false} animate={false} />
        </div>
        <PrintTable
          table={buildWithdrawalTable('taxes', accounts, retirement, incomeStreams, meta)}
        />
      </Section>

      <Section title="Methodology">
        <MethodologyPanel profile={profile} assumptions={assumptions} />
      </Section>
    </div>
  );
}
