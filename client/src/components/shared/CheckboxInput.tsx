interface CheckboxInputProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  helpText?: string;
  disabled?: boolean;
  id?: string;
}

export function CheckboxInput({
  label,
  checked,
  onChange,
  helpText,
  disabled,
  id,
}: CheckboxInputProps) {
  const inputId = id || label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex items-start gap-3">
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-fortress-navy
          focus:ring-fortress-navy disabled:opacity-50"
      />
      <div>
        <label htmlFor={inputId} className="text-sm font-medium text-fortress-slate cursor-pointer">
          {label}
        </label>
        {helpText && <p className="text-xs text-gray-400 mt-0.5">{helpText}</p>}
      </div>
    </div>
  );
}
