interface StepDef {
  label: string;
  shortLabel: string;
}

interface StepIndicatorProps {
  currentStep: number;
  steps: StepDef[];
  onStepClick?: (step: number) => void;
}

export function StepIndicator({ currentStep, steps, onStepClick }: StepIndicatorProps) {
  return (
    <nav aria-label="Intake progress" className="w-full">
      {/* Mobile: simple text */}
      <div className="sm:hidden text-center text-sm text-fortress-slate">
        Step {currentStep + 1} of {steps.length}:{' '}
        <span className="font-semibold">{steps[currentStep].label}</span>
      </div>

      {/* Desktop: dot + line indicator */}
      <div className="hidden sm:flex items-center justify-between">
        {steps.map((step, i) => {
          const isCompleted = i < currentStep;
          const isCurrent = i === currentStep;
          const isClickable = isCompleted && onStepClick;

          return (
            <div key={step.label} className="flex items-center flex-1 last:flex-none">
              <button
                type="button"
                onClick={() => isClickable && onStepClick(i)}
                disabled={!isClickable}
                className={`flex flex-col items-center gap-1 group
                  ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                    transition-colors
                    ${isCurrent ? 'bg-fortress-navy text-white' : ''}
                    ${isCompleted ? 'bg-fortress-green text-white' : ''}
                    ${!isCurrent && !isCompleted ? 'bg-gray-200 text-gray-500' : ''}`}
                >
                  {isCompleted ? '✓' : i + 1}
                </div>
                <span
                  className={`text-xs whitespace-nowrap
                    ${isCurrent ? 'text-fortress-navy font-semibold' : 'text-gray-400'}`}
                >
                  {step.shortLabel}
                </span>
              </button>

              {/* Connector line */}
              {i < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 mt-[-1rem]
                    ${i < currentStep ? 'bg-fortress-green' : 'bg-gray-200'}`}
                />
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
