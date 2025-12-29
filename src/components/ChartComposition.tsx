import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import { Account, AccumulationResult, getTaxTreatment, TaxTreatment } from '../types';
import { CHART_COLORS } from '../utils/constants';

interface ChartCompositionProps {
  accounts: Account[];
  result: AccumulationResult;
  isDarkMode?: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

const TAX_TREATMENT_LABELS: Record<TaxTreatment, string> = {
  pretax: 'Pre-Tax',
  roth: 'Roth (Tax-Free)',
  taxable: 'Taxable',
  hsa: 'HSA',
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { color: string } }>;
  total: number;
}

function CustomTooltip({ active, payload, total }: CustomTooltipProps) {
  if (!active || !payload || !payload[0]) return null;

  const data = payload[0];
  const percentage = ((data.value / total) * 100).toFixed(1);

  return (
    <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
      <div className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: data.payload.color }}
        />
        <span className="font-medium text-gray-900 dark:text-white">{data.name}</span>
      </div>
      <div className="mt-1 text-sm">
        <div className="text-gray-900 dark:text-white">{formatCurrency(data.value)}</div>
        <div className="text-gray-500 dark:text-gray-400">{percentage}% of portfolio</div>
      </div>
    </div>
  );
}

interface LabelProps {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
}

function renderCustomizedLabel(props: LabelProps) {
  const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 } = props;
  if (percent < 0.05) return null; // Don't show labels for small slices

  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      className="text-xs font-medium"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export function ChartComposition({ accounts, result, isDarkMode = false }: ChartCompositionProps) {
  // Colors based on dark mode
  const labelColor = isDarkMode ? '#9ca3af' : '#374151';
  // Create data by tax treatment
  const taxTreatmentData = Object.entries(result.breakdownByTaxTreatment)
    .filter(([treatment]) => result.breakdownByTaxTreatment[treatment as TaxTreatment] > 0)
    .map(([treatment, value]) => ({
      name: TAX_TREATMENT_LABELS[treatment as TaxTreatment],
      value,
      color: CHART_COLORS[treatment as TaxTreatment],
    }));

  // Create data by individual account
  const accountData = accounts
    .map(account => ({
      name: account.name,
      value: result.finalBalances[account.id] || 0,
      color: CHART_COLORS[getTaxTreatment(account.type)],
    }))
    .filter(d => d.value > 0);

  const total = result.totalAtRetirement;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* By Tax Treatment */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center mb-2">
          By Tax Treatment
        </h4>
        <div className="h-64 touch-pan-y">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={taxTreatmentData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                labelLine={false}
                label={renderCustomizedLabel}
              >
                {taxTreatmentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip total={total} />} />
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
                formatter={(value) => <span style={{ color: labelColor }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* By Account */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center mb-2">
          By Account
        </h4>
        <div className="h-64 touch-pan-y">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={accountData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                labelLine={false}
                label={renderCustomizedLabel}
              >
                {accountData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip total={total} />} />
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
                formatter={(value) => <span style={{ color: labelColor }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
