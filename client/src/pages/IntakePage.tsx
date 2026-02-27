import { IntakeWizard } from '../components/intake/IntakeWizard';

export function IntakePage() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-fortress-navy mb-2">Financial Intake</h2>
      <p className="text-gray-600 mb-8">
        Enter your financial information step by step. Your data stays encrypted on your device.
      </p>
      <IntakeWizard />
    </div>
  );
}
