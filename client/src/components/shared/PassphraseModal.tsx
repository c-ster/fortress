import { useState, type FormEvent } from 'react';

interface PassphraseModalProps {
  isOpen: boolean;
  mode: 'save' | 'load';
  onConfirm: (passphrase: string) => Promise<void>;
  onCancel: () => void;
  error?: string;
  isLoading?: boolean;
}

export function PassphraseModal({
  isOpen,
  mode,
  onConfirm,
  onCancel,
  error,
  isLoading,
}: PassphraseModalProps) {
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (passphrase.length < 8) {
      setLocalError('Passphrase must be at least 8 characters');
      return;
    }

    if (mode === 'save' && passphrase !== confirm) {
      setLocalError('Passphrases do not match');
      return;
    }

    await onConfirm(passphrase);
  };

  const handleClose = () => {
    setPassphrase('');
    setConfirm('');
    setLocalError('');
    onCancel();
  };

  const displayError = localError || error;
  const isSave = mode === 'save';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="passphrase-modal-title">
      {/* Backdrop */}
      <div
        role="button"
        tabIndex={-1}
        aria-label="Close modal"
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
        onKeyDown={(e) => { if (e.key === 'Escape') handleClose(); }}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl border border-gray-200 p-6
        w-full max-w-md mx-4">
        <h3 id="passphrase-modal-title" className="text-lg font-bold text-fortress-navy mb-1">
          {isSave ? 'Encrypt & Save Your Data' : 'Decrypt Your Data'}
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          {isSave
            ? 'Choose a passphrase to encrypt your financial data. This is separate from your login password — remember it to access your data later.'
            : 'Enter the passphrase you used when saving your data.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="passphrase"
              className="block text-sm font-medium text-fortress-slate mb-1"
            >
              {isSave ? 'Encryption Passphrase' : 'Passphrase'}
            </label>
            <input
              id="passphrase"
              type="password"
              required
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              minLength={8}
              value={passphrase}
              onChange={(e) => { setPassphrase(e.target.value); setLocalError(''); }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                focus:border-fortress-navy focus:ring-1 focus:ring-fortress-navy"
              placeholder="8+ characters"
              disabled={isLoading}
            />
          </div>

          {isSave && (
            <div>
              <label
                htmlFor="confirm-passphrase"
                className="block text-sm font-medium text-fortress-slate mb-1"
              >
                Confirm Passphrase
              </label>
              <input
                id="confirm-passphrase"
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setLocalError(''); }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                  focus:border-fortress-navy focus:ring-1 focus:ring-fortress-navy"
                placeholder="Re-enter passphrase"
                disabled={isLoading}
              />
            </div>
          )}

          {displayError && (
            <div className="text-sm text-fortress-red bg-red-50 border border-red-200
              rounded-md px-3 py-2">
              {displayError}
            </div>
          )}

          {isSave && (
            <div className="text-xs text-gray-400 bg-gray-50 rounded-md px-3 py-2">
              Your data is encrypted client-side before being sent to the server.
              Fortress cannot decrypt your financial data without this passphrase.
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800
                transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="bg-fortress-navy text-white px-6 py-2 rounded-md text-sm
                font-medium hover:bg-fortress-navy/90 disabled:opacity-50
                disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isLoading && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent
                  rounded-full animate-spin" />
              )}
              {isLoading
                ? (isSave ? 'Encrypting...' : 'Decrypting...')
                : (isSave ? 'Encrypt & Save' : 'Decrypt & Load')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
