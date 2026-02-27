import { useState, useCallback } from 'react';

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  disabled?: boolean;
  autoFilled?: boolean;
  helpText?: string;
  id?: string;
  required?: boolean;
}

export function NumberInput({
  label,
  value,
  onChange,
  prefix = '$',
  suffix,
  min,
  max,
  step,
  placeholder,
  disabled,
  autoFilled,
  helpText,
  id,
  required,
}: NumberInputProps) {
  const inputId = id || label.toLowerCase().replace(/\s+/g, '-');
  const [focused, setFocused] = useState(false);
  const [displayValue, setDisplayValue] = useState('');

  const formatForDisplay = useCallback(
    (num: number): string => {
      if (num === 0) return '';
      if (prefix === '$') {
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      return String(num);
    },
    [prefix],
  );

  const handleFocus = () => {
    setFocused(true);
    setDisplayValue(value === 0 ? '' : String(value));
  };

  const handleBlur = () => {
    setFocused(false);
    const parsed = parseFloat(displayValue);
    if (!isNaN(parsed)) {
      let clamped = parsed;
      if (min !== undefined) clamped = Math.max(min, clamped);
      if (max !== undefined) clamped = Math.min(max, clamped);
      onChange(clamped);
    } else if (displayValue === '') {
      onChange(0);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayValue(e.target.value);
  };

  const shown = focused ? displayValue : formatForDisplay(value);

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-fortress-slate mb-1">
        {label}
        {required && <span className="text-fortress-red ml-1">*</span>}
        {autoFilled && (
          <span className="ml-2 text-xs font-normal text-fortress-green">Auto-filled</span>
        )}
      </label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
            {prefix}
          </span>
        )}
        <input
          id={inputId}
          type={focused ? 'text' : 'text'}
          inputMode="decimal"
          value={shown}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder || '0'}
          disabled={disabled}
          step={step}
          className={`w-full rounded-md border px-3 py-2 text-sm text-fortress-slate
            focus:border-fortress-navy focus:ring-1 focus:ring-fortress-navy outline-none
            disabled:bg-gray-100 disabled:text-gray-400
            ${prefix ? 'pl-7' : ''}
            ${suffix ? 'pr-8' : ''}
            ${autoFilled ? 'bg-green-50 border-fortress-green/30' : 'border-gray-300'}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
            {suffix}
          </span>
        )}
      </div>
      {helpText && <p className="text-xs text-gray-400 mt-1">{helpText}</p>}
    </div>
  );
}
