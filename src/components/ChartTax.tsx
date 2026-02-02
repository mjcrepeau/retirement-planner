import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { RetirementResult } from '../types';
import { CHART_COLORS } from '../utils/constants';

interface ChartTaxProps {
  result: RetirementResult;
  isDarkMode?: boolean;
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
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
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: number;
  result: RetirementResult;
}

function CustomTooltip({ active, payload, label, result }: CustomTooltipProps) {
  if (!active || !payload) return null;

  const yearData = result.yearlyWithdrawals.find(y => y.age === label);
  if (!yearData) return null;

  const effectiveRate = yearData.grossIncome > 0
    ? ((yearData.totalTax / yearData.grossIncome) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
      <p className="font-medium text-gray-900 dark:text-white mb-2">Age {label}</p>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-blue-600 dark:text-blue-400">Federal Tax:</span>
          <span className="font-medium text-gray-900 dark:text-white">{formatTooltipValue(yearData.federalTax)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-purple-600 dark:text-purple-400">State Tax:</span>
          <span className="font-medium text-gray-900 dark:text-white">{formatTooltipValue(yearData.stateTax)}</span>
        </div>
        {yearData.totalPenalties > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-red-600 dark:text-red-400">Penalties:</span>
            <span className="font-medium text-red-600 dark:text-red-400">{formatTooltipValue(yearData.totalPenalties)}</span>
          </div>
        )}
        <div className="border-t border-gray-200 dark:border-gray-600 mt-2 pt-2">
          <div className="flex justify-between gap-4 font-semibold">
            <span style={{ color: CHART_COLORS.tax }}>Total Tax:</span>
            <span className="text-gray-900 dark:text-white">{formatTooltipValue(yearData.totalTax)}</span>
          </div>
          <div className="flex justify-between gap-4 text-gray-600 dark:text-gray-400 mt-1">
            <span>Effective Rate:</span>
            <span>{effectiveRate}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChartTax({ result, isDarkMode = false }: ChartTaxProps) {
  // Colors based on dark mode
  const gridColor = isDarkMode ? '#374151' : '#e5e7eb';
  const tickColor = isDarkMode ? '#9ca3af' : '#6b7280';
  const tickLineColor = isDarkMode ? '#4b5563' : '#d1d5db';
  // Transform data for the chart
  const chartData = result.yearlyWithdrawals.map(year => {
    const effectiveRate = year.grossIncome > 0
      ? (year.totalTax / year.grossIncome) * 100
      : 0;

    return {
      age: year.age,
      federalTax: year.federalTax,
      stateTax: year.stateTax,
      totalTax: year.totalTax,
      effectiveRate,
    };
  });

  return (
    <div className="w-full h-80 touch-pan-y">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 50, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis
            dataKey="age"
            tick={{ fontSize: 12, fill: tickColor }}
            tickLine={{ stroke: tickLineColor }}
            stroke={tickLineColor}
          />
          <YAxis
            yAxisId="left"
            tickFormatter={formatCurrency}
            tick={{ fontSize: 12, fill: tickColor }}
            tickLine={{ stroke: tickLineColor }}
            stroke={tickLineColor}
            width={60}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(v) => `${v.toFixed(0)}%`}
            tick={{ fontSize: 12, fill: tickColor }}
            tickLine={{ stroke: tickLineColor }}
            stroke={tickLineColor}
            domain={[0, 40]}
            width={50}
          />
          <Tooltip content={<CustomTooltip result={result} />} />
          <Legend
            wrapperStyle={{ paddingTop: '10px' }}
            formatter={(value) => <span style={{ color: tickColor }}>{value}</span>}
          />
          <Bar
            yAxisId="left"
            dataKey="federalTax"
            name="Federal Tax"
            stackId="tax"
            fill="#3b82f6"
            fillOpacity={0.8}
          />
          <Bar
            yAxisId="left"
            dataKey="stateTax"
            name="State Tax"
            stackId="tax"
            fill="#8b5cf6"
            fillOpacity={0.8}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="effectiveRate"
            name="Effective Rate"
            stroke={CHART_COLORS.tax}
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
