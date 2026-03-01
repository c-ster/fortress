/**
 * Automated WCAG 2.1 AA accessibility tests.
 *
 * Uses axe-core to validate that key UI components produce
 * accessible HTML. Covers shared inputs, dashboard widgets,
 * navigation, modals, and form sections.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from './axe-helper';

// ── Shared form components ─────────────────────────────────────────
import { TextInput } from '../../src/components/shared/TextInput';
import { NumberInput } from '../../src/components/shared/NumberInput';
import { SelectInput } from '../../src/components/shared/SelectInput';
import { CheckboxInput } from '../../src/components/shared/CheckboxInput';
import { FormSection } from '../../src/components/shared/FormSection';
import { NavigationButtons } from '../../src/components/shared/NavigationButtons';
import { StepIndicator } from '../../src/components/shared/StepIndicator';
import { PassphraseModal } from '../../src/components/shared/PassphraseModal';

// ── Dashboard components ───────────────────────────────────────────
import { RiskScore } from '../../src/components/dashboard/RiskScore';
import { ActionCard } from '../../src/components/dashboard/ActionCard';
import { FindingCard } from '../../src/components/dashboard/FindingCard';
import type { Action, RiskFinding } from '@fortress/types';

// ── Noop helpers ───────────────────────────────────────────────────
const noop = () => {};
const asyncNoop = async () => {};

const sampleAction: Action = {
  id: 'a1',
  riskFindingId: 'f1',
  title: 'Build emergency fund',
  description: 'Save 3 months of expenses in a high-yield savings account',
  mechanism: 'Set up allotment from myPay → HYSA',
  amount: 4500,
  deadline: 'Within 90 days',
  estimatedImpact: '+15 points',
  difficulty: 'easy',
  estimatedMinutes: 20,
  status: 'pending',
};

const sampleFinding: RiskFinding = {
  id: 'f1',
  category: 'emergency_fund',
  severity: 'critical',
  title: 'No emergency fund',
  description: 'Less than 1 month of expenses saved',
  impact: 'High risk of financial crisis during deployment',
  actionId: 'a1',
  pointsDeducted: 25,
  weight: 1,
};

// ── Tests ──────────────────────────────────────────────────────────

describe('WCAG 2.1 AA — shared form inputs', () => {
  it('TextInput has no violations', async () => {
    const { container } = render(
      <TextInput label="Full Name" value="John" onChange={noop} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('TextInput with required marker has no violations', async () => {
    const { container } = render(
      <TextInput label="Email" value="" onChange={noop} required helpText="Enter email" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('NumberInput has no violations', async () => {
    const { container } = render(
      <NumberInput label="Monthly Income" value={5000} onChange={noop} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('SelectInput has no violations', async () => {
    const { container } = render(
      <SelectInput
        label="Branch"
        value="army"
        onChange={noop}
        options={[
          { value: 'army', label: 'Army' },
          { value: 'navy', label: 'Navy' },
        ]}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('CheckboxInput has no violations', async () => {
    const { container } = render(
      <CheckboxInput label="I agree to the terms" checked={false} onChange={noop} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('WCAG 2.1 AA — layout components', () => {
  it('FormSection has no violations', async () => {
    const { container } = render(
      <FormSection title="Personal Info" description="Basic details">
        <p>Content here</p>
      </FormSection>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('NavigationButtons has no violations', async () => {
    const { container } = render(
      <NavigationButtons onBack={noop} onNext={noop} isFirst={false} isLast={false} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('StepIndicator has no violations', async () => {
    const steps = [
      { label: 'Military', shortLabel: 'Military' },
      { label: 'Income', shortLabel: 'Income' },
      { label: 'Review', shortLabel: 'Review' },
    ];
    const { container } = render(<StepIndicator currentStep={1} steps={steps} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('WCAG 2.1 AA — dashboard widgets', () => {
  it('RiskScore has no violations', async () => {
    const { container } = render(<RiskScore score={72} tier="yellow" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('RiskScore SVG has accessible label', () => {
    const { container } = render(<RiskScore score={85} tier="green" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toContain('85');
    expect(svg?.getAttribute('aria-label')).toContain('Ready');
  });

  it('ActionCard has no violations', async () => {
    const { container } = render(
      <ActionCard action={sampleAction} onStatusChange={noop} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('FindingCard has no violations', async () => {
    const { container } = render(
      <FindingCard finding={sampleFinding} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('WCAG 2.1 AA — modals', () => {
  it('PassphraseModal (save mode) has dialog role', async () => {
    const { container } = render(
      <PassphraseModal
        isOpen={true}
        mode="save"
        onConfirm={asyncNoop}
        onCancel={noop}
      />,
    );
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBeTruthy();
  });

  it('PassphraseModal (save mode) has no axe violations', async () => {
    const { container } = render(
      <PassphraseModal
        isOpen={true}
        mode="save"
        onConfirm={asyncNoop}
        onCancel={noop}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('PassphraseModal (load mode) has no axe violations', async () => {
    const { container } = render(
      <PassphraseModal
        isOpen={false}
        mode="load"
        onConfirm={asyncNoop}
        onCancel={noop}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('WCAG 2.1 AA — semantic structure', () => {
  it('form inputs have associated labels via htmlFor', () => {
    const { container } = render(
      <TextInput label="Test Field" value="" onChange={noop} />,
    );
    const label = container.querySelector('label');
    const input = container.querySelector('input');
    expect(label?.getAttribute('for')).toBeTruthy();
    expect(input?.getAttribute('id')).toBe(label?.getAttribute('for'));
  });

  it('select inputs have associated labels via htmlFor', () => {
    const { container } = render(
      <SelectInput
        label="Pay Grade"
        value=""
        onChange={noop}
        options={[{ value: 'E-5', label: 'E-5' }]}
      />,
    );
    const label = container.querySelector('label');
    const select = container.querySelector('select');
    expect(label?.getAttribute('for')).toBeTruthy();
    expect(select?.getAttribute('id')).toBe(label?.getAttribute('for'));
  });

  it('step indicator uses aria-current for active step', () => {
    const steps = [
      { label: 'Step 1', shortLabel: 'S1' },
      { label: 'Step 2', shortLabel: 'S2' },
    ];
    const { container } = render(<StepIndicator currentStep={0} steps={steps} />);
    const buttons = container.querySelectorAll('button');
    expect(buttons[0]?.getAttribute('aria-current')).toBe('step');
    expect(buttons[1]?.getAttribute('aria-current')).toBeNull();
  });
});

describe('WCAG 2.1 AA — ESLint plugin coverage', () => {
  it('eslint-plugin-jsx-a11y is configured', async () => {
    // Validate the eslint config includes jsx-a11y for client TSX files
    const fs = await import('fs');
    const path = await import('path');
    const raw = fs.readFileSync(
      path.resolve(process.cwd(), '..', '.eslintrc.json'),
      'utf8',
    );
    const config = JSON.parse(raw);
    const tsxOverride = config.overrides?.find(
      (o: { files: string[] }) => o.files?.includes('client/src/**/*.tsx'),
    );
    expect(tsxOverride).toBeTruthy();
    expect(tsxOverride.plugins).toContain('jsx-a11y');
    expect(tsxOverride.extends).toContain('plugin:jsx-a11y/recommended');
  });
});
