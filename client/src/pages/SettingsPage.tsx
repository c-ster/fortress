import { useState } from 'react';
import { FormSection } from '../components/shared/FormSection';
import { MilVerification } from '../components/auth/MilVerification';
import { useAuthStore } from '../stores/auth';

export function SettingsPage() {
  const { user } = useAuthStore();

  return (
    <div>
      <h2 className="text-2xl font-bold text-fortress-navy mb-2">Account Settings</h2>
      <p className="text-gray-600 mb-6">
        Manage your account, military verification, and security settings.
      </p>

      {/* Account Info */}
      <FormSection title="Account" description="Your basic account information">
        <div className="text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium text-fortress-slate">Email:</span>
            <span className="text-gray-600">{user?.email ?? 'Not available'}</span>
          </div>
        </div>
      </FormSection>

      {/* Military Verification */}
      <FormSection
        title="Military Verification"
        description="Verify your military status with a .mil email"
        className="mt-4"
      >
        <MilVerification />
      </FormSection>

      {/* MFA Setup */}
      <FormSection
        title="Two-Factor Authentication"
        description="Add an extra layer of security to your account"
        className="mt-4"
      >
        <MfaSetup />
      </FormSection>
    </div>
  );
}

// --- Inline MFA Setup Component ---

type MfaPhase = 'idle' | 'loading' | 'setup' | 'confirming' | 'enabled';

function MfaSetup() {
  const { user, setupMfa, confirmMfa } = useAuthStore();
  const [phase, setPhase] = useState<MfaPhase>(user?.mfaEnabled ? 'enabled' : 'idle');
  const [secret, setSecret] = useState('');
  const [uri, setUri] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  // Already enabled
  if (phase === 'enabled' || user?.mfaEnabled) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-fortress-green">
          <span className="font-bold">&#10003;</span>
          Two-factor authentication is enabled
        </span>
      </div>
    );
  }

  const handleBeginSetup = async () => {
    setPhase('loading');
    setError('');
    const result = await setupMfa();
    if (result) {
      setSecret(result.secret);
      setUri(result.uri);
      setPhase('setup');
    } else {
      setError('Failed to initialize MFA setup. Please try again.');
      setPhase('idle');
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPhase('confirming');
    const success = await confirmMfa(code.trim());
    if (success) {
      setPhase('enabled');
    } else {
      setError('Invalid code — please try again');
      setPhase('setup');
    }
  };

  // Idle — show "Enable MFA" button
  if (phase === 'idle' || phase === 'loading') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-500">
          Protect your account with a TOTP authenticator app like Google Authenticator,
          Authy, or 1Password.
        </p>
        {error && (
          <div className="text-sm text-fortress-red bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}
        <button
          onClick={handleBeginSetup}
          disabled={phase === 'loading'}
          className="bg-fortress-navy text-white px-5 py-2 rounded-md text-sm font-medium
            hover:bg-fortress-navy/90 disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors"
        >
          {phase === 'loading' ? 'Setting up...' : 'Enable MFA'}
        </button>
      </div>
    );
  }

  // Setup — show secret + verify form
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Add this account to your authenticator app using the secret below, then
        enter the generated code to confirm.
      </p>

      {/* Secret display */}
      <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
        <p className="text-xs font-medium text-fortress-slate mb-2">
          Secret Key (manual entry)
        </p>
        <div className="flex items-center gap-2">
          <code className="text-sm font-mono bg-white border border-gray-200 rounded px-3 py-1.5
            select-all break-all">
            {secret}
          </code>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(secret)}
            className="text-xs text-fortress-navy hover:underline whitespace-nowrap"
          >
            Copy
          </button>
        </div>

        {uri && (
          <div className="mt-3">
            <p className="text-xs font-medium text-fortress-slate mb-1">
              Or use this link in your authenticator app:
            </p>
            <a
              href={uri}
              className="text-xs text-fortress-navy hover:underline break-all"
            >
              Open in authenticator
            </a>
          </div>
        )}
      </div>

      {/* Confirm form */}
      <form onSubmit={handleConfirm} className="space-y-3">
        <div>
          <label
            htmlFor="mfa-confirm-code"
            className="block text-sm font-medium text-fortress-slate mb-1"
          >
            Enter code from your authenticator
          </label>
          <input
            id="mfa-confirm-code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, ''));
              setError('');
            }}
            className="w-full max-w-[200px] rounded-md border border-gray-300 px-3 py-2
              text-sm text-center tracking-widest font-mono
              focus:border-fortress-navy focus:ring-1 focus:ring-fortress-navy"
            placeholder="000000"
            disabled={phase === 'confirming'}
          />
        </div>

        {error && (
          <div className="text-sm text-fortress-red bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={phase === 'confirming' || code.length !== 6}
            className="bg-fortress-navy text-white px-5 py-2 rounded-md text-sm font-medium
              hover:bg-fortress-navy/90 disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors"
          >
            {phase === 'confirming' ? 'Confirming...' : 'Confirm & Enable'}
          </button>
          <button
            type="button"
            onClick={() => { setPhase('idle'); setCode(''); setError(''); setSecret(''); setUri(''); }}
            className="text-sm text-gray-500 hover:text-fortress-navy"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
