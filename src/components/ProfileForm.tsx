import { Profile, FilingStatus } from '../types';

interface ProfileFormProps {
  profile: Profile;
  onChange: (profile: Profile) => void;
}

export function ProfileForm({ profile, onChange }: ProfileFormProps) {
  const handleChange = (field: keyof Profile, value: number | string) => {
    onChange({
      ...profile,
      [field]: value,
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-600 pb-2">Personal Information</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Current Age
          </label>
          <input
            type="number"
            value={profile.currentAge}
            onChange={(e) => handleChange('currentAge', parseInt(e.target.value) || 0)}
            min={18}
            max={100}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Retirement Age
          </label>
          <input
            type="number"
            value={profile.retirementAge}
            onChange={(e) => handleChange('retirementAge', parseInt(e.target.value) || 0)}
            min={profile.currentAge + 1}
            max={100}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Life Expectancy
          </label>
          <input
            type="number"
            value={profile.lifeExpectancy}
            onChange={(e) => handleChange('lifeExpectancy', parseInt(e.target.value) || 0)}
            min={profile.retirementAge + 1}
            max={120}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Filing Status
          </label>
          <select
            value={profile.filingStatus}
            onChange={(e) => handleChange('filingStatus', e.target.value as FilingStatus)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="single">Single</option>
            <option value="married_filing_jointly">Married Filing Jointly</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            State Tax Rate (%)
          </label>
          <input
            type="number"
            value={(profile.stateTaxRate * 100).toFixed(1)}
            onChange={(e) => handleChange('stateTaxRate', (parseFloat(e.target.value) || 0) / 100)}
            min={0}
            max={15}
            step={0.1}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mt-6 mb-3">Social Security</h4>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Annual Benefit (today's $)
            <span className="text-gray-500 text-xs ml-1" title="Your estimated annual Social Security benefit in today's dollars">
              ⓘ
            </span>
          </label>
          <input
            type="number"
            value={profile.socialSecurityBenefit || ''}
            onChange={(e) => handleChange('socialSecurityBenefit', parseFloat(e.target.value) || 0)}
            min={0}
            placeholder="0"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Start Age
          </label>
          <input
            type="number"
            value={profile.socialSecurityStartAge || 67}
            onChange={(e) => handleChange('socialSecurityStartAge', parseInt(e.target.value) || 67)}
            min={62}
            max={70}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
      </div>
    </div>
  );
}
