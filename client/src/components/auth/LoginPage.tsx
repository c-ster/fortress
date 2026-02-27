import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const result = await login(email, password);
    if (result === 'success') {
      navigate('/intake');
    } else if (result === 'mfa_required') {
      navigate('/mfa-verify');
    }
    // 'error' → store.error already set, displayed below
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <h2 className="text-2xl font-bold text-fortress-navy mb-2">Sign In</h2>
        <p className="text-sm text-gray-500 mb-6">
          Access your secure financial readiness plan.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-fortress-slate mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearError(); }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                focus:border-fortress-navy focus:ring-1 focus:ring-fortress-navy"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-fortress-slate mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearError(); }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                focus:border-fortress-navy focus:ring-1 focus:ring-fortress-navy"
              placeholder="8+ characters"
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
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-fortress-navy font-medium hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
