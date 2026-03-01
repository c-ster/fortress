import { useState, type FormEvent } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { config } from '../config';
import { useAuthStore } from '../stores/auth';

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-3">&#9888;&#65039;</div>
          <h2 className="text-xl font-bold text-fortress-navy mb-2">Invalid Invite Link</h2>
          <p className="text-sm text-gray-500 mb-4">
            This link is missing an invite token. Please ask the service member to send a new invite.
          </p>
          <Link
            to="/"
            className="text-sm text-fortress-navy font-medium hover:underline"
          >
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${config.apiUrl}/homefront/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ inviteToken: token, email, password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Failed to accept invite' }));
        setError(body.message || 'Failed to accept invite');
        return;
      }

      const data = await res.json();

      // Set auth session directly (bypass register flow)
      setSession(data.accessToken, {
        id: data.user.id,
        email: data.user.email,
        milVerified: false,
        mfaEnabled: false,
      });

      navigate('/homefront');
    } catch {
      setError('Network error — please try again');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <h2 className="text-2xl font-bold text-fortress-navy mb-2">Accept Homefront Invitation</h2>
        <p className="text-sm text-gray-500 mb-6">
          Create an account to access your partner&apos;s financial snapshot.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="hf-email" className="block text-sm font-medium text-fortress-slate mb-1">
              Email
            </label>
            <input
              id="hf-email"
              type="email"
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                focus:border-fortress-navy focus:ring-1 focus:ring-fortress-navy outline-none"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="hf-password" className="block text-sm font-medium text-fortress-slate mb-1">
              Password
            </label>
            <input
              id="hf-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                focus:border-fortress-navy focus:ring-1 focus:ring-fortress-navy outline-none"
              placeholder="8+ characters"
            />
          </div>

          <div>
            <label htmlFor="hf-confirm" className="block text-sm font-medium text-fortress-slate mb-1">
              Confirm Password
            </label>
            <input
              id="hf-confirm"
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setError(''); }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                focus:border-fortress-navy focus:ring-1 focus:ring-fortress-navy outline-none"
              placeholder="Re-enter password"
            />
          </div>

          {error && (
            <div className="text-sm text-fortress-red bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-fortress-navy text-white py-2 rounded-md font-medium
              hover:bg-fortress-navy/90 disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors"
          >
            {isLoading ? 'Creating account...' : 'Accept & Create Account'}
          </button>
        </form>

        <p className="text-xs text-gray-400 mt-4 text-center">
          After creating your account, you&apos;ll need the service member&apos;s encryption
          passphrase to view their financial data.
        </p>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="text-fortress-navy font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
