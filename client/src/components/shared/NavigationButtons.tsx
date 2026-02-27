interface NavigationButtonsProps {
  onBack: () => void;
  onNext: () => void;
  onSave?: () => void;
  isFirst: boolean;
  isLast: boolean;
  nextLabel?: string;
  saveLabel?: string;
  disabled?: boolean;
}

export function NavigationButtons({
  onBack,
  onNext,
  onSave,
  isFirst,
  isLast,
  nextLabel,
  saveLabel = 'Save & Encrypt',
  disabled,
}: NavigationButtonsProps) {
  return (
    <div className="flex justify-between items-center pt-4 border-t border-gray-200">
      <div>
        {!isFirst && (
          <button
            type="button"
            onClick={onBack}
            className="border border-gray-300 text-fortress-slate px-6 py-2 rounded-md
              font-medium hover:bg-gray-50 transition-colors"
          >
            Back
          </button>
        )}
      </div>
      <div className="flex gap-3">
        {!isLast && (
          <button
            type="button"
            onClick={onNext}
            disabled={disabled}
            className="bg-fortress-navy text-white px-6 py-2 rounded-md font-medium
              hover:bg-fortress-navy/90 disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors"
          >
            {nextLabel || 'Next'}
          </button>
        )}
        {isLast && onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={disabled}
            className="bg-fortress-green text-white px-6 py-2 rounded-md font-medium
              hover:bg-fortress-green/90 disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors"
          >
            {saveLabel}
          </button>
        )}
      </div>
    </div>
  );
}
