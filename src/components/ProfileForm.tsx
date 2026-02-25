import { Profile, FilingStatus } from '../types';
import { NumberInput } from './NumberInput';
import { Tooltip } from './Tooltip';
import { useCountry } from '../contexts/CountryContext';

interface ProfileFormProps {
  profile: Profile;
  onChange: (profile: Profile) => void;
}

const inputClassName = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white";

export function ProfileForm({ profile, onChange }: ProfileFormProps) {
  const { country } = useCountry();

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
          <NumberInput
            value={profile.currentAge}
            onChange={(val) => handleChange('currentAge', val)}
            min={18}
            max={100}
            defaultValue={35}
            className={inputClassName}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Retirement Age
          </label>
          <NumberInput
            value={profile.retirementAge}
            onChange={(val) => handleChange('retirementAge', val)}
            min={18}
            max={100}
            defaultValue={65}
            className={inputClassName}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Life Expectancy
          </label>
          <NumberInput
            value={profile.lifeExpectancy}
            onChange={(val) => handleChange('lifeExpectancy', val)}
            min={18}
            max={120}
            defaultValue={90}
            className={inputClassName}
          />
        </div>

        {country === 'US' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Filing Status
            </label>
            <select
              value={profile.filingStatus}
              onChange={(e) => handleChange('filingStatus', e.target.value as FilingStatus)}
              className={inputClassName}
            >
              <option value="single">Single</option>
              <option value="married_filing_jointly">Married Filing Jointly</option>
            </select>
          </div>
        )}

        {country === 'CA' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Province
            </label>
            <select
              value={profile.region || 'ON'}
              onChange={(e) => handleChange('region', e.target.value)}
              className={inputClassName}
            >
              <option value="AB">Alberta</option>
              <option value="BC">British Columbia</option>
              <option value="MB">Manitoba</option>
              <option value="NB">New Brunswick</option>
              <option value="NL">Newfoundland and Labrador</option>
              <option value="NS">Nova Scotia</option>
              <option value="NT">Northwest Territories</option>
              <option value="NU">Nunavut</option>
              <option value="ON">Ontario</option>
              <option value="PE">Prince Edward Island</option>
              <option value="QC">Quebec</option>
              <option value="SK">Saskatchewan</option>
              <option value="YT">Yukon</option>
            </select>
          </div>
        )}

        {country === 'US' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              State Tax Rate (%)
            </label>
            <NumberInput
              value={profile.stateTaxRate || 0}
              onChange={(val) => handleChange('stateTaxRate', val)}
              min={0}
              max={15}
              isPercentage
              decimals={1}
              defaultValue={0.05}
              className={inputClassName}
            />
          </div>
        )}
      </div>

      {country === 'CA' && (
        <>
          <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mt-6 mb-3">
            CPP (Canada Pension Plan)
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Annual Benefit (today's $)
                <Tooltip text="Your estimated annual CPP benefit in today's dollars" />
              </label>
              <NumberInput
                value={profile.socialSecurityBenefit || 0}
                onChange={(val) => handleChange('socialSecurityBenefit', val)}
                min={0}
                placeholder="0"
                defaultValue={0}
                className={inputClassName}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Age
              </label>
              <NumberInput
                value={profile.socialSecurityStartAge || 65}
                onChange={(val) => handleChange('socialSecurityStartAge', val)}
                min={60}
                max={70}
                defaultValue={65}
                className={inputClassName}
              />
            </div>
          </div>
        </>
      )}

      {/* OAS Section - Canada Only */}
      {country === 'CA' && (
        <>
          <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mt-6 mb-3">
            OAS (Old Age Security)
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Annual Benefit (today's $)
                <Tooltip text="Your estimated annual OAS benefit in today's dollars. Max is ~$9,000/year in 2024." />
              </label>
              <NumberInput
                value={profile.secondaryBenefitAmount || 0}
                onChange={(val) => handleChange('secondaryBenefitAmount', val)}
                min={0}
                placeholder="0"
                defaultValue={0}
                className={inputClassName}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Age
              </label>
              <NumberInput
                value={profile.secondaryBenefitStartAge || 65}
                onChange={(val) => handleChange('secondaryBenefitStartAge', val)}
                min={65}
                max={70}
                defaultValue={65}
                className={inputClassName}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
