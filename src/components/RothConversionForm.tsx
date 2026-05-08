import { useState } from 'react';
import { ConversionPlan, Account, getTaxTreatment } from '../types';
import { NumberInput } from './NumberInput';
import { v4 as uuidv4 } from 'uuid';

interface RothConversionFormProps {
  accounts: Account[];
  conversionPlan?: ConversionPlan;
  currentAge: number;
  lifeExpectancy: number;
  onSave: (plan: ConversionPlan) => void;
  onCancel: () => void;
}

const inputClassName = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white";
const inputErrorClassName = "w-full px-3 py-2 border border-red-500 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white";

export function RothConversionForm({
  accounts,
  conversionPlan,
  currentAge,
  lifeExpectancy,
  onSave,
  onCancel,
}: RothConversionFormProps) {
  const sourceCandidates = accounts.filter(a => getTaxTreatment(a.type) === 'pretax');
  const destCandidates = accounts.filter(a => getTaxTreatment(a.type) === 'roth');

  const [formData, setFormData] = useState<Omit<ConversionPlan, 'id'>>(() => {
    if (conversionPlan) {
      const { id: _id, ...rest } = conversionPlan;
      void _id;
      return rest;
    }
    return {
      name: '',
      sourceAccountId: sourceCandidates[0]?.id ?? '',
      destinationAccountId: destCandidates[0]?.id ?? '',
      startAge: Math.max(currentAge, 60),
      endAge: Math.max(currentAge, 70),
      yearlyAmount: 30000,
    };
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = <K extends keyof Omit<ConversionPlan, 'id'>>(
    field: K,
    value: Omit<ConversionPlan, 'id'>[K],
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field as string]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field as string];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.sourceAccountId) newErrors.sourceAccountId = 'Source account is required';
    if (!formData.destinationAccountId) newErrors.destinationAccountId = 'Destination account is required';
    if (formData.sourceAccountId === formData.destinationAccountId) {
      newErrors.destinationAccountId = 'Source and destination must differ';
    }
    if (formData.yearlyAmount <= 0) newErrors.yearlyAmount = 'Yearly amount must be greater than 0';
    if (formData.startAge < 0 || formData.startAge > 120) newErrors.startAge = 'Start age must be 0–120';
    if (formData.endAge < formData.startAge) newErrors.endAge = 'End age must be ≥ start age';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({ id: conversionPlan?.id || uuidv4(), ...formData });
  };

  if (sourceCandidates.length === 0) {
    return (
      <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded">
        <p className="text-sm text-amber-800 dark:text-amber-300">
          No eligible source accounts. Add a Traditional IRA or 401(k) first.
        </p>
        <div className="flex justify-end pt-3">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-50 dark:hover:bg-gray-500">
            Close
          </button>
        </div>
      </div>
    );
  }

  if (destCandidates.length === 0) {
    return (
      <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded">
        <p className="text-sm text-amber-800 dark:text-amber-300">
          No eligible Roth destinations. Add a Roth IRA or Roth 401(k) first.
        </p>
        <div className="flex justify-end pt-3">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-50 dark:hover:bg-gray-500">
            Close
          </button>
        </div>
      </div>
    );
  }

  const showPastWarn = formData.endAge < currentAge;
  const showFutureWarn = formData.startAge > lifeExpectancy;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
        <input
          type="text"
          value={formData.name}
          onChange={e => handleChange('name', e.target.value)}
          placeholder="e.g., 401k → Roth ladder"
          className={errors.name ? inputErrorClassName : inputClassName}
        />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Source Account</label>
          <select
            value={formData.sourceAccountId}
            onChange={e => handleChange('sourceAccountId', e.target.value)}
            className={errors.sourceAccountId ? inputErrorClassName : inputClassName}
          >
            {sourceCandidates.map(a => (<option key={a.id} value={a.id}>{a.name}</option>))}
          </select>
          {errors.sourceAccountId && <p className="text-red-500 text-xs mt-1">{errors.sourceAccountId}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Destination Account</label>
          <select
            value={formData.destinationAccountId}
            onChange={e => handleChange('destinationAccountId', e.target.value)}
            className={errors.destinationAccountId ? inputErrorClassName : inputClassName}
          >
            {destCandidates.map(a => (<option key={a.id} value={a.id}>{a.name}</option>))}
          </select>
          {errors.destinationAccountId && <p className="text-red-500 text-xs mt-1">{errors.destinationAccountId}</p>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Age</label>
          <NumberInput
            value={formData.startAge}
            onChange={v => handleChange('startAge', v)}
            min={0} max={120} defaultValue={60}
            className={errors.startAge ? inputErrorClassName : inputClassName}
          />
          {errors.startAge && <p className="text-red-500 text-xs mt-1">{errors.startAge}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Age</label>
          <NumberInput
            value={formData.endAge}
            onChange={v => handleChange('endAge', v)}
            min={0} max={120} defaultValue={70}
            className={errors.endAge ? inputErrorClassName : inputClassName}
          />
          {errors.endAge && <p className="text-red-500 text-xs mt-1">{errors.endAge}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Yearly ($, today)</label>
          <NumberInput
            value={formData.yearlyAmount}
            onChange={v => handleChange('yearlyAmount', v)}
            min={0} defaultValue={30000}
            className={errors.yearlyAmount ? inputErrorClassName : inputClassName}
          />
          {errors.yearlyAmount && <p className="text-red-500 text-xs mt-1">{errors.yearlyAmount}</p>}
        </div>
      </div>

      {showPastWarn && (
        <p className="text-amber-600 dark:text-amber-400 text-xs">
          Warning: end age is in the past — this plan will not produce any conversions.
        </p>
      )}
      {showFutureWarn && (
        <p className="text-amber-600 dark:text-amber-400 text-xs">
          Warning: start age is past life expectancy — this plan will not produce any conversions.
        </p>
      )}

      <div className="flex justify-end gap-3 pt-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-50 dark:hover:bg-gray-500">
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
          {conversionPlan ? 'Update' : 'Add Conversion'}
        </button>
      </div>
    </form>
  );
}
