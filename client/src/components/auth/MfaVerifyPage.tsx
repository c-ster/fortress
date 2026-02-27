import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';

export function MfaVerifyPage() {
  const [code, setCode] = useState('');
  const { verifyMfa, requiresMfa, accessToken, isLoading, error, clearError } =
    useAuthStore();
  const navigate = useNavigate();

  // If not in MFA challenge state, redirect to login
  if (!requiresMfa || !accessToken) {
    return <Navigate to="/login" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const success = await verifyMfa(code.trim());
    if (success) {
      navigate('/intake');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <h2 className="text-2xl font-bold text-fortress-navy mb-2">
          Two-Factor Authentication
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Enter the 6-digit code from your authenticator app.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="mfa-code"
              className="block text-sm font-medium text-fortress-slate mb-1"
            >
              Verification Code
            </label>
            <input
              id="mfa-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => {
                // Only allow digits
                const val = e.target.value.replace(/\D/g, '');
                setCode(val);
                clearError();
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                text-center text-2xl tracking-[0.5em] font-mono
                focus:border-fortress-navy focus:ring-1 focus:ring-fortress-navy"
              placeholder="000000"
            />
          </div>

          {error && (
            <div className="text-sm text-fortress-red bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || code.length !== 6}
            className="w-full bg-fortress-navy text-white py-2 rounded-md font-medium
              hover:bg-fortress-navy/90 disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors"
          >
            {isLoading ? 'Verifying...' : 'Verify'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          Open your authenticator app to find your code.
        </p>
      </div>
    </div>
  );
}
