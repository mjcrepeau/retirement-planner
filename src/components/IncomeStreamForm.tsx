import { useState } from 'react';
import { IncomeStream, IncomeTaxTreatment, getIncomeTaxTreatmentLabel } from '../types';
import { NumberInput } from './NumberInput';
import { v4 as uuidv4 } from 'uuid';

interface IncomeStreamFormProps {
  incomeStream?: IncomeStream;
  onSave: (stream: IncomeStream) => void;
  onCancel: () => void;
}

const inputClassName = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white";
const inputErrorClassName = "w-full px-3 py-2 border border-red-500 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white";

const TAX_TREATMENTS: IncomeTaxTreatment[] = ['social_security', 'fully_taxable', 'tax_free'];

export function IncomeStreamForm({ incomeStream, onSave, onCancel }: IncomeStreamFormProps) {
  const [formData, setFormData] = useState<Omit<IncomeStream, 'id'>>(() => {
    if (incomeStream) {
      const { id: _id, ...rest } = incomeStream;
      void _id;
      return rest;
    }
    return {
      name: '',
      monthlyAmount: 0,
      startAge: 67,
      taxTreatment: 'social_security',
    };
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: keyof Omit<IncomeStream, 'id'>, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (formData.monthlyAmount <= 0) {
      newErrors.monthlyAmount = 'Monthly amount must be greater than 0';
    }
    if (formData.startAge < 0 || formData.startAge > 120) {
      newErrors.startAge = 'Start age must be between 0 and 120';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({
      id: incomeStream?.id || uuidv4(),
      ...formData,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Name *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="e.g., Social Security, NC State Pension"
          className={errors.name ? inputErrorClassName : inputClassName}
        />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Monthly Benefit ($)
          </label>
          <NumberInput
            value={formData.monthlyAmount}
            onChange={(val) => handleChange('monthlyAmount', val)}
            min={0}
            defaultValue={0}
            className={errors.monthlyAmount ? inputErrorClassName : inputClassName}
          />
          {errors.monthlyAmount && <p className="text-red-500 text-xs mt-1">{errors.monthlyAmount}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Start Age
          </label>
          <NumberInput
            value={formData.startAge}
            onChange={(val) => handleChange('startAge', val)}
            min={0}
            max={120}
            defaultValue={67}
            className={errors.startAge ? inputErrorClassName : inputClassName}
          />
          {errors.startAge && <p className="text-red-500 text-xs mt-1">{errors.startAge}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Tax Treatment
        </label>
        <select
          value={formData.taxTreatment}
          onChange={(e) => handleChange('taxTreatment', e.target.value as IncomeTaxTreatment)}
          className={inputClassName}
        >
          {TAX_TREATMENTS.map(treatment => (
            <option key={treatment} value={treatment}>
              {getIncomeTaxTreatmentLabel(treatment)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-50 dark:hover:bg-gray-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          {incomeStream ? 'Update' : 'Add Income Stream'}
        </button>
      </div>
    </form>
  );
}
