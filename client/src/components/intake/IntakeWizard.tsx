import { useIntakeWizard } from '../../hooks/useIntakeWizard';
import { StepIndicator } from '../shared/StepIndicator';
import { NavigationButtons } from '../shared/NavigationButtons';
import { StepMilitary } from './StepMilitary';
import { StepIncome } from './StepIncome';
import { StepDeductions } from './StepDeductions';
import { StepExpenses } from './StepExpenses';
import { StepDebts } from './StepDebts';
import { StepAssets } from './StepAssets';
import { StepReview } from './StepReview';

export function IntakeWizard() {
  const wizard = useIntakeWizard();

  const stepComponents = [
    <StepMilitary key="military" />,
    <StepIncome key="income" />,
    <StepDeductions key="deductions" />,
    <StepExpenses key="expenses" />,
    <StepDebts key="debts" />,
    <StepAssets key="assets" />,
    <StepReview key="review" goTo={wizard.goTo} />,
  ];

  return (
    <div className="space-y-6">
      <StepIndicator
        currentStep={wizard.currentStep}
        steps={wizard.steps}
        onStepClick={wizard.goTo}
      />
      <div className="min-h-[400px]">{stepComponents[wizard.currentStep]}</div>
      <NavigationButtons
        onBack={wizard.back}
        onNext={wizard.next}
        isFirst={wizard.isFirst}
        isLast={wizard.isLast}
        nextLabel={wizard.currentStep === 5 ? 'Review Summary' : undefined}
      />
    </div>
  );
}
