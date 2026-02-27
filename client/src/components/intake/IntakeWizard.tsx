import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useIntakeWizard } from '../../hooks/useIntakeWizard';
import { StepIndicator } from '../shared/StepIndicator';
import { NavigationButtons } from '../shared/NavigationButtons';
import { PassphraseModal } from '../shared/PassphraseModal';
import { StepMilitary } from './StepMilitary';
import { StepIncome } from './StepIncome';
import { StepDeductions } from './StepDeductions';
import { StepExpenses } from './StepExpenses';
import { StepDebts } from './StepDebts';
import { StepAssets } from './StepAssets';
import { StepReview } from './StepReview';
import { encryptCurrentState, saveSnapshot } from '../../crypto';
import { useAuthStore } from '../../stores/auth';

export function IntakeWizard() {
  const wizard = useIntakeWizard();
  const accessToken = useAuthStore((s) => s.accessToken);

  const [showPassphrase, setShowPassphrase] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = useCallback(() => {
    setSaveError('');
    setSaveSuccess(false);
    setShowPassphrase(true);
  }, []);

  const handleConfirmSave = useCallback(
    async (passphrase: string) => {
      if (!accessToken) {
        setSaveError('Not authenticated — please sign in again');
        return;
      }

      setIsSaving(true);
      setSaveError('');
      try {
        const payload = await encryptCurrentState(passphrase);
        await saveSnapshot(payload, accessToken);
        setShowPassphrase(false);
        setSaveSuccess(true);
        // Auto-dismiss success after 3 seconds
        setTimeout(() => setSaveSuccess(false), 3000);
      } catch (err) {
        setSaveError(
          err instanceof Error ? err.message : 'Failed to save — please try again',
        );
      } finally {
        setIsSaving(false);
      }
    },
    [accessToken],
  );

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

      {/* Success banner */}
      {saveSuccess && (
        <div className="bg-green-50 border border-fortress-green/30 rounded-md px-4 py-3
          text-sm text-green-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-fortress-green font-bold">&#10003;</span>
            Data encrypted and saved successfully.
          </div>
          <Link
            to="/dashboard"
            className="text-fortress-navy font-medium hover:underline text-sm"
          >
            View Results &rarr;
          </Link>
        </div>
      )}

      <NavigationButtons
        onBack={wizard.back}
        onNext={wizard.next}
        onSave={handleSave}
        isFirst={wizard.isFirst}
        isLast={wizard.isLast}
        nextLabel={wizard.currentStep === 5 ? 'Review Summary' : undefined}
      />

      <PassphraseModal
        isOpen={showPassphrase}
        mode="save"
        onConfirm={handleConfirmSave}
        onCancel={() => setShowPassphrase(false)}
        error={saveError}
        isLoading={isSaving}
      />
    </div>
  );
}
