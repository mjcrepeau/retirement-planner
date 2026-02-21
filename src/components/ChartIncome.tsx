import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import { RetirementResult, IncomeStream } from '../types';
import { CHART_COLORS } from '../utils/constants';

interface ChartIncomeProps {
  result: RetirementResult;
  incomeStreams?: IncomeStream[];
  isDarkMode?: boolean;
}

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatTooltipValue(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; dataKey: string }>;
  label?: number;
  result: RetirementResult;
}

function CustomTooltip({ active, payload, label, result }: CustomTooltipProps) {
  if (!active || !payload) return null;

  const yearData = result.yearlyWithdrawals.find(y => y.age === label);
  if (!yearData) return null;

  return (
    <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
      <p className="font-medium text-gray-900 dark:text-white mb-2">Age {label}</p>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span style={{ color: CHART_COLORS.pretax }}>Withdrawals:</span>
          <span className="font-medium text-gray-900 dark:text-white">{formatTooltipValue(yearData.totalWithdrawal)}</span>
        </div>
        {payload?.filter(p => ['socialSecurity', 'pension', 'taxFreeIncome'].includes(p.dataKey) && p.value > 0).map(p => (
          <div key={p.dataKey} className="flex justify-between gap-4">
            <span style={{ color: p.color }}>{p.name}:</span>
            <span className="font-medium text-gray-900 dark:text-white">{formatTooltipValue(p.value)}</span>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t border-gray-200 dark:border-gray-600 pt-1 mt-1">
          <span className="text-gray-600 dark:text-gray-400">Gross Income:</span>
          <span className="font-medium text-gray-900 dark:text-white">{formatTooltipValue(yearData.grossIncome)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span style={{ color: CHART_COLORS.tax }}>Taxes:</span>
          <span className="font-medium text-red-600 dark:text-red-400">
            -{formatTooltipValue(yearData.totalTax)}
            {yearData.totalPenalties > 0 && (
              <span className="text-xs"> (includes {formatTooltipValue(yearData.totalPenalties)} penalties)</span>
            )}
          </span>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-600 mt-2 pt-2 flex justify-between gap-4 font-semibold">
          <span style={{ color: CHART_COLORS.spending }}>After-Tax Income:</span>
          <span className="text-gray-900 dark:text-white">{formatTooltipValue(yearData.afterTaxIncome)}</span>
        </div>
      </div>
    </div>
  );
}

export function ChartIncome({ result, incomeStreams = [], isDarkMode = false }: ChartIncomeProps) {
  // Colors based on dark mode
  const gridColor = isDarkMode ? '#374151' : '#e5e7eb';
  const tickColor = isDarkMode ? '#9ca3af' : '#6b7280';
  const tickLineColor = isDarkMode ? '#4b5563' : '#d1d5db';
  // Determine which income stream bands have data
  const hasPensionStreams = incomeStreams.some(s => s.taxTreatment === 'fully_taxable');
  const hasTaxFreeStreams = incomeStreams.some(s => s.taxTreatment === 'tax_free');

  // Transform data for the chart
  // Show gross income as stacked bars (positive), taxes as separate negative bar
  const chartData = result.yearlyWithdrawals.map(year => {
    let ssIncome = 0;
    let pensionIncome = 0;
    let taxFreeIncome = 0;

    // Split incomeStreamIncome proportionally by tax treatment
    const activeStreams = incomeStreams.filter(s => year.age >= s.startAge);
    const totalMonthly = activeStreams.reduce((sum, s) => sum + s.monthlyAmount, 0);

    if (totalMonthly > 0 && year.incomeStreamIncome > 0) {
      for (const stream of activeStreams) {
        const ratio = stream.monthlyAmount / totalMonthly;
        const streamAmount = year.incomeStreamIncome * ratio;
        switch (stream.taxTreatment) {
          case 'social_security': ssIncome += streamAmount; break;
          case 'fully_taxable': pensionIncome += streamAmount; break;
          case 'tax_free': taxFreeIncome += streamAmount; break;
        }
      }
    }

    // Government benefits (Canada CPP/OAS) go into the SS band
    ssIncome += year.governmentBenefitIncome;

    return {
      age: year.age,
      withdrawals: year.totalWithdrawal,
      socialSecurity: ssIncome,
      pension: pensionIncome,
      taxFreeIncome: taxFreeIncome,
      taxes: year.totalTax,
      afterTax: year.afterTaxIncome,
      gross: year.grossIncome,
    };
  });

  return (
    <div className="w-full h-80 touch-pan-y">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis
            dataKey="age"
            tick={{ fontSize: 12, fill: tickColor }}
            tickLine={{ stroke: tickLineColor }}
            stroke={tickLineColor}
          />
          <YAxis
            tickFormatter={formatCurrency}
            tick={{ fontSize: 12, fill: tickColor }}
            tickLine={{ stroke: tickLineColor }}
            stroke={tickLineColor}
            width={60}
          />
          <Tooltip content={<CustomTooltip result={result} />} />
          <Legend
            wrapperStyle={{ paddingTop: '10px' }}
            formatter={(value) => <span style={{ color: tickColor }}>{value}</span>}
          />
          <ReferenceLine y={0} stroke="#9ca3af" />
          {/* Gross income components - stacked bars */}
          <Bar
            dataKey="withdrawals"
            name="Withdrawals"
            stackId="income"
            fill={CHART_COLORS.pretax}
            fillOpacity={0.8}
          />
          <Bar
            dataKey="socialSecurity"
            name="Social Security"
            stackId="income"
            fill={CHART_COLORS.socialSecurity}
            fillOpacity={0.8}
          />
          {hasPensionStreams && (
            <Bar
              dataKey="pension"
              name="Pension"
              stackId="income"
              fill={CHART_COLORS.pension}
              fillOpacity={0.8}
            />
          )}
          {hasTaxFreeStreams && (
            <Bar
              dataKey="taxFreeIncome"
              name="Tax-Free Income"
              stackId="income"
              fill={CHART_COLORS.taxFreeIncome}
              fillOpacity={0.8}
            />
          )}
          {/* After-tax income line - the key metric */}
          <Line
            type="monotone"
            dataKey="afterTax"
            name="After-Tax Income"
            stroke={CHART_COLORS.spending}
            strokeWidth={3}
            dot={false}
          />
          {/* Taxes as a separate line for reference */}
          <Line
            type="monotone"
            dataKey="taxes"
            name="Taxes Paid"
            stroke={CHART_COLORS.tax}
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
