import { useState, useEffect, useCallback } from 'react';
import { IntakeWizard } from '../components/intake/IntakeWizard';
import { PassphraseModal } from '../components/shared/PassphraseModal';
import { loadSnapshot, decryptAndHydrate, DecryptionError } from '../crypto';
import { useAuthStore } from '../stores/auth';

type LoadState = 'checking' | 'has-snapshot' | 'no-snapshot' | 'loaded' | 'error';

export function IntakePage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [loadState, setLoadState] = useState<LoadState>('checking');
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [snapshotPayload, setSnapshotPayload] = useState<Awaited<ReturnType<typeof loadSnapshot>>>(null);

  // Check for existing snapshot on mount
  useEffect(() => {
    if (!accessToken) {
      setLoadState('no-snapshot');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const snapshot = await loadSnapshot(accessToken);
        if (cancelled) return;
        if (snapshot) {
          setSnapshotPayload(snapshot);
          setLoadState('has-snapshot');
        } else {
          setLoadState('no-snapshot');
        }
      } catch {
        if (!cancelled) setLoadState('no-snapshot');
      }
    })();
    return () => { cancelled = true; };
  }, [accessToken]);

  const handleLoadConfirm = useCallback(
    async (passphrase: string) => {
      if (!snapshotPayload) return;
      setIsDecrypting(true);
      setLoadError('');
      try {
        await decryptAndHydrate(snapshotPayload, passphrase);
        setShowLoadModal(false);
        setLoadState('loaded');
      } catch (err) {
        if (err instanceof DecryptionError) {
          setLoadError('Wrong passphrase — please try again');
        } else {
          setLoadError(
            err instanceof Error ? err.message : 'Failed to decrypt data',
          );
        }
      } finally {
        setIsDecrypting(false);
      }
    },
    [snapshotPayload],
  );

  const handleSkipLoad = () => {
    setLoadState('no-snapshot');
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-fortress-navy mb-2">Financial Intake</h2>
      <p className="text-gray-600 mb-6">
        Enter your financial information step by step. Your data is encrypted before
        leaving your device.
      </p>

      {/* Checking for saved data */}
      {loadState === 'checking' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6
          flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-fortress-navy border-t-transparent
            rounded-full animate-spin" />
          <span className="text-sm text-gray-600">Checking for saved data...</span>
        </div>
      )}

      {/* Found saved data — offer to load */}
      {loadState === 'has-snapshot' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="text-sm font-semibold text-fortress-navy mb-1">
            Saved Data Found
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            You have previously saved financial data. Would you like to load it?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => { setLoadError(''); setShowLoadModal(true); }}
              className="bg-fortress-navy text-white px-5 py-2 rounded-md text-sm
                font-medium hover:bg-fortress-navy/90 transition-colors"
            >
              Load My Data
            </button>
            <button
              onClick={handleSkipLoad}
              className="border border-gray-300 text-gray-600 px-5 py-2 rounded-md
                text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Start Fresh
            </button>
          </div>
        </div>
      )}

      {/* Data loaded successfully */}
      {loadState === 'loaded' && (
        <div className="bg-green-50 border border-fortress-green/30 rounded-md px-4 py-3
          mb-6 text-sm text-green-800 flex items-center gap-2">
          <span className="text-fortress-green font-bold">&#10003;</span>
          Your saved financial data has been loaded successfully.
        </div>
      )}

      {/* Show wizard unless we're still checking */}
      {loadState !== 'checking' && <IntakeWizard />}

      <PassphraseModal
        isOpen={showLoadModal}
        mode="load"
        onConfirm={handleLoadConfirm}
        onCancel={() => setShowLoadModal(false)}
        error={loadError}
        isLoading={isDecrypting}
      />
    </div>
  );
}
