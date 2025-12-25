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

export function ChartComposition({ accounts, result }: ChartCompositionProps) {
  // Create data by tax treatment
  const taxTreatmentData = Object.entries(result.breakdownByTaxTreatment)
    .filter(([_, value]) => value > 0)
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

  const CustomTooltip = ({ active, payload }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; payload: { color: string } }>;
  }) => {
    if (!active || !payload || !payload[0]) return null;

    const data = payload[0];
    const percentage = ((data.value / total) * 100).toFixed(1);

    return (
      <div className="bg-white p-3 border rounded-lg shadow-lg">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: data.payload.color }}
          />
          <span className="font-medium">{data.name}</span>
        </div>
        <div className="mt-1 text-sm">
          <div>{formatCurrency(data.value)}</div>
          <div className="text-gray-500">{percentage}% of portfolio</div>
        </div>
      </div>
    );
  };

  const renderCustomizedLabel = (props: {
    cx?: number;
    cy?: number;
    midAngle?: number;
    innerRadius?: number;
    outerRadius?: number;
    percent?: number;
  }) => {
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
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* By Tax Treatment */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 text-center mb-2">
          By Tax Treatment
        </h4>
        <div className="h-64">
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
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
                formatter={(value) => <span className="text-gray-700">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* By Account */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 text-center mb-2">
          By Account
        </h4>
        <div className="h-64">
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
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
                formatter={(value) => <span className="text-gray-700">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
