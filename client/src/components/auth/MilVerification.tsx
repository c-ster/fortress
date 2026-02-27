import { useState, type FormEvent } from 'react';
import { useAuthStore } from '../../stores/auth';

type Phase = 'idle' | 'sending' | 'code' | 'verifying' | 'verified';

export function MilVerification() {
  const { user, verifyMilEmail, verifyMilCode } = useAuthStore();
  const [phase, setPhase] = useState<Phase>(user?.milVerified ? 'verified' : 'idle');
  const [milEmail, setMilEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState('');

  // Already verified
  if (phase === 'verified' || user?.milVerified) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-fortress-green">
          <span className="font-bold">&#10003;</span>
          Military email verified
        </span>
        {verifiedEmail && (
          <span className="text-xs text-gray-400">({verifiedEmail})</span>
        )}
      </div>
    );
  }

  const handleSendCode = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate .mil domain
    if (!milEmail.trim().toLowerCase().endsWith('.mil')) {
      setError('Please enter a valid .mil email address');
      return;
    }

    setPhase('sending');
    try {
      await verifyMilEmail(milEmail.trim());
      setPhase('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send verification code');
      setPhase('idle');
    }
  };

  const handleVerifyCode = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setPhase('verifying');
    try {
      const result = await verifyMilCode(code.trim());
      if (result.success) {
        setVerifiedEmail(result.milEmail ?? milEmail);
        setPhase('verified');
      } else {
        setError('Verification failed');
        setPhase('code');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code');
      setPhase('code');
    }
  };

  // Phase 1: Enter .mil email
  if (phase === 'idle' || phase === 'sending') {
    return (
      <form onSubmit={handleSendCode} className="space-y-3">
        <p className="text-sm text-gray-500">
          Verify your military status by confirming access to a .mil email address.
        </p>

        <div>
          <label
            htmlFor="mil-email"
            className="block text-sm font-medium text-fortress-slate mb-1"
          >
            Military Email
          </label>
          <input
            id="mil-email"
            type="email"
            required
            value={milEmail}
            onChange={(e) => { setMilEmail(e.target.value); setError(''); }}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
              focus:border-fortress-navy focus:ring-1 focus:ring-fortress-navy"
            placeholder="name@mail.mil"
            disabled={phase === 'sending'}
          />
        </div>

        {error && (
          <div className="text-sm text-fortress-red bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={phase === 'sending'}
          className="bg-fortress-navy text-white px-5 py-2 rounded-md text-sm font-medium
            hover:bg-fortress-navy/90 disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors"
        >
          {phase === 'sending' ? 'Sending...' : 'Send Verification Code'}
        </button>
      </form>
    );
  }

  // Phase 2: Enter verification code
  return (
    <form onSubmit={handleVerifyCode} className="space-y-3">
      <p className="text-sm text-gray-500">
        We sent a 6-digit code to <strong>{milEmail}</strong>. Enter it below.
      </p>

      <div>
        <label
          htmlFor="mil-code"
          className="block text-sm font-medium text-fortress-slate mb-1"
        >
          Verification Code
        </label>
        <input
          id="mil-code"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
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
          disabled={phase === 'verifying'}
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
          disabled={phase === 'verifying' || code.length !== 6}
          className="bg-fortress-navy text-white px-5 py-2 rounded-md text-sm font-medium
            hover:bg-fortress-navy/90 disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors"
        >
          {phase === 'verifying' ? 'Verifying...' : 'Verify Code'}
        </button>
        <button
          type="button"
          onClick={() => { setPhase('idle'); setCode(''); setError(''); }}
          className="text-sm text-gray-500 hover:text-fortress-navy"
        >
          Change email
        </button>
      </div>
    </form>
  );
}
