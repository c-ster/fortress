interface SelectOption {
  value: string;
  label: string;
}

interface SelectInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  helpText?: string;
  id?: string;
  required?: boolean;
}

export function SelectInput({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  helpText,
  id,
  required,
}: SelectInputProps) {
  const inputId = id || label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-fortress-slate mb-1">
        {label}
        {required && <span className="text-fortress-red ml-1">*</span>}
      </label>
      <select
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-fortress-slate
          focus:border-fortress-navy focus:ring-1 focus:ring-fortress-navy outline-none
          disabled:bg-gray-100 disabled:text-gray-400"
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {helpText && <p className="text-xs text-gray-400 mt-1">{helpText}</p>}
    </div>
  );
}
