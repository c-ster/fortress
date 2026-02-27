import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState('');
  const { register, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (password !== confirm) {
      setLocalError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return;
    }

    const success = await register(email, password);
    if (success) {
      navigate('/intake');
    }
  };

  const displayError = localError || error;

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <h2 className="text-2xl font-bold text-fortress-navy mb-2">Create Account</h2>
        <p className="text-sm text-gray-500 mb-6">
          Start your secure financial readiness assessment.
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
              onChange={(e) => { setEmail(e.target.value); clearError(); setLocalError(''); }}
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
              onChange={(e) => { setPassword(e.target.value); clearError(); setLocalError(''); }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                focus:border-fortress-navy focus:ring-1 focus:ring-fortress-navy"
              placeholder="8+ characters"
            />
          </div>

          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-fortress-slate mb-1">
              Confirm Password
            </label>
            <input
              id="confirm"
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setLocalError(''); }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                focus:border-fortress-navy focus:ring-1 focus:ring-fortress-navy"
              placeholder="Re-enter password"
            />
          </div>

          {displayError && (
            <div className="text-sm text-fortress-red bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {displayError}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-fortress-navy text-white py-2 rounded-md font-medium
              hover:bg-fortress-navy/90 disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors"
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

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
