interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  helpText?: string;
  maxLength?: number;
  pattern?: string;
  id?: string;
  required?: boolean;
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  helpText,
  maxLength,
  pattern,
  id,
  required,
}: TextInputProps) {
  const inputId = id || label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-fortress-slate mb-1">
        {label}
        {required && <span className="text-fortress-red ml-1">*</span>}
      </label>
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        pattern={pattern}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-fortress-slate
          focus:border-fortress-navy focus:ring-1 focus:ring-fortress-navy outline-none
          disabled:bg-gray-100 disabled:text-gray-400"
      />
      {helpText && <p className="text-xs text-gray-400 mt-1">{helpText}</p>}
    </div>
  );
}
