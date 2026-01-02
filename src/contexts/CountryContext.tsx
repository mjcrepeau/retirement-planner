import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { CountryCode, CountryConfig, getCountryConfig } from '../countries';

interface CountryContextValue {
  country: CountryCode;
  config: CountryConfig;
  setCountry: (country: CountryCode) => void;
}

const CountryContext = createContext<CountryContextValue | undefined>(undefined);

interface CountryProviderProps {
  children: ReactNode;
  initialCountry?: CountryCode;
  onCountryChange?: (newCountry: CountryCode) => void;
}

// Load country from localStorage or use default
const getInitialCountry = (defaultCountry: CountryCode): CountryCode => {
  try {
    const stored = localStorage.getItem('retirement-planner-country');
    if (stored === 'US' || stored === 'CA') {
      return stored;
    }
  } catch (error) {
    console.error('Error loading country from localStorage:', error);
  }
  return defaultCountry;
};

export function CountryProvider({ children, initialCountry = 'US', onCountryChange }: CountryProviderProps) {
  const [country, setCountryState] = useState<CountryCode>(() => getInitialCountry(initialCountry));
  const [config, setConfig] = useState<CountryConfig>(() => getCountryConfig(getInitialCountry(initialCountry)));

  // Persist country to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('retirement-planner-country', country);
    } catch (error) {
      console.error('Error saving country to localStorage:', error);
    }
  }, [country]);

  const setCountry = useCallback((newCountry: CountryCode) => {
    if (newCountry === country) return;

    // Show confirmation dialog if switching countries
    const confirmSwitch = window.confirm(
      `Switch to ${newCountry === 'US' ? 'United States' : 'Canada'}? This will reset your profile and accounts to default values.`
    );

    if (confirmSwitch) {
      setCountryState(newCountry);
      setConfig(getCountryConfig(newCountry));

      // Call the country change callback to reset profile and accounts
      if (onCountryChange) {
        onCountryChange(newCountry);
      }
    }
  }, [country, onCountryChange]);

  return (
    <CountryContext.Provider value={{ country, config, setCountry }}>
      {children}
    </CountryContext.Provider>
  );
}

export function useCountry(): CountryContextValue {
  const context = useContext(CountryContext);
  if (!context) {
    throw new Error('useCountry must be used within a CountryProvider');
  }
  return context;
}
