import { useState, type FormEvent } from 'react';
import type { FinancialState, EncryptedPayload } from '@fortress/types';
import { decrypt, DecryptionError, encrypt } from '../../crypto/crypto';
import type { SpouseGrant } from '../../hooks/useHomefront';

interface SpouseViewProps {
  grant: SpouseGrant;
  onLoadSnapshot: () => Promise<EncryptedPayload | null>;
  onSaveSnapshot: (payload: EncryptedPayload) => Promise<boolean>;
}

type ViewState = 'locked' | 'decrypting' | 'viewing' | 'saving' | 'error';

function fmt(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function SpouseView({ grant, onLoadSnapshot, onSaveSnapshot }: SpouseViewProps) {
  const [viewState, setViewState] = useState<ViewState>('locked');
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [data, setData] = useState<FinancialState | null>(null);
  const [savedPassphrase, setSavedPassphrase] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  const handleDecrypt = async (e: FormEvent) => {
    e.preventDefault();
    if (!passphrase) return;

    setViewState('decrypting');
    setError('');

    try {
      const payload = await onLoadSnapshot();
      if (!payload) {
        setError('No financial snapshot found. The service member may not have saved data yet.');
        setViewState('error');
        return;
      }

      const json = await decrypt(payload, passphrase);
      const parsed = JSON.parse(json) as FinancialState;
      setData(parsed);
      setSavedPassphrase(passphrase);
      setPassphrase('');
      setViewState('viewing');
    } catch (err) {
      if (err instanceof DecryptionError) {
        setError('Decryption failed — check your passphrase and try again.');
      } else {
        setError('An unexpected error occurred.');
      }
      setViewState('error');
    }
  };

  const handleSave = async () => {
    if (!data || !savedPassphrase) return;
    setViewState('saving');
    setSaveMessage('');

    try {
      const json = JSON.stringify(data);
      const payload = await encrypt(json, savedPassphrase);
      const ok = await onSaveSnapshot(payload);
      setSaveMessage(ok ? 'Snapshot saved successfully.' : 'Failed to save snapshot.');
    } catch {
      setSaveMessage('Encryption error — could not save.');
    } finally {
      setViewState('viewing');
    }
  };

  // --- Locked / Error state ---
  if (viewState === 'locked' || viewState === 'decrypting' || viewState === 'error') {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">&#128274;</div>
            <h3 className="text-lg font-bold text-fortress-navy">Encrypted Financial Data</h3>
            <p className="text-sm text-gray-500 mt-1">
              Enter the encryption passphrase shared by{' '}
              <span className="font-medium">{grant.ownerEmail}</span> to view their financial snapshot.
            </p>
          </div>

          <form onSubmit={handleDecrypt} className="space-y-4">
            <div>
              <label htmlFor="hf-passphrase" className="block text-sm font-medium text-fortress-slate mb-1">
                Encryption Passphrase
              </label>
              <input
                id="hf-passphrase"
                type="password"
                value={passphrase}
                onChange={(e) => { setPassphrase(e.target.value); setError(''); }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                  focus:border-fortress-navy focus:ring-1 focus:ring-fortress-navy outline-none"
                placeholder="Enter passphrase"
                autoFocus
              />
            </div>

            {error && (
              <div className="text-sm text-fortress-red bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={viewState === 'decrypting' || !passphrase}
              className="w-full bg-fortress-navy text-white py-2 rounded-md font-medium
                hover:bg-fortress-navy/90 disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors"
            >
              {viewState === 'decrypting' ? 'Decrypting...' : 'Decrypt & View'}
            </button>
          </form>

          <p className="text-xs text-gray-400 mt-4 text-center">
            This is NOT your login password. Ask the service member for their data passphrase.
          </p>
        </div>
      </div>
    );
  }

  // --- Viewing state ---
  if (!data) return null;
  const { income, expenses, debts, assets, risk } = data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-fortress-navy">Financial Snapshot</h3>
          <p className="text-sm text-gray-500">
            Viewing data for {grant.ownerEmail} &middot;{' '}
            {grant.permission === 'write' ? 'View & Edit' : 'View Only'}
          </p>
        </div>
        <button
          onClick={() => { setData(null); setViewState('locked'); setSavedPassphrase(''); }}
          className="text-sm text-gray-500 hover:text-fortress-navy transition-colors"
        >
          Lock
        </button>
      </div>

      {/* Income */}
      <SummaryCard title="Income">
        <Row label="Base Pay" value={fmt(income.basePay)} />
        <Row label="BAH" value={fmt(income.bah)} />
        <Row label="BAS" value={fmt(income.bas)} />
        {income.cola > 0 && <Row label="COLA" value={fmt(income.cola)} />}
        <TotalRow label="Total Gross" value={fmt(income.totalGross)} />
      </SummaryCard>

      {/* Expenses */}
      <SummaryCard title="Monthly Expenses">
        <Row label="Housing" value={fmt(expenses.housing)} />
        <Row label="Utilities" value={fmt(expenses.utilities)} />
        <Row label="Transportation" value={fmt(expenses.transportation)} />
        <Row label="Food" value={fmt(expenses.food)} />
        <TotalRow label="Total Monthly" value={fmt(expenses.totalMonthly)} />
      </SummaryCard>

      {/* Debts */}
      <SummaryCard title="Debts">
        <Row label="Number of Debts" value={String(debts.length)} />
        <Row
          label="Total Minimum Payments"
          value={fmt(debts.reduce((sum, d) => sum + d.monthlyPayment, 0))}
        />
        <Row label="High-Interest Total" value={fmt(risk.highInterestDebtTotal)} />
      </SummaryCard>

      {/* Assets */}
      <SummaryCard title="Assets">
        <Row label="Checking" value={fmt(assets.checkingBalance)} />
        <Row label="Savings" value={fmt(assets.savingsBalance)} />
        <Row label="TSP Balance" value={fmt(assets.tspBalance)} />
        <TotalRow label="Total Liquid" value={fmt(assets.totalLiquid)} />
      </SummaryCard>

      {/* Risk Indicators */}
      <SummaryCard title="Key Indicators">
        <Row label="Emergency Fund" value={`${risk.emergencyFundMonths.toFixed(1)} months`} />
        <Row label="Debt-to-Income" value={pct(risk.debtToIncomeRatio)} />
        <Row label="SGLI Adequate" value={risk.sgliAdequate ? 'Yes' : 'No'} />
        <Row label="TSP Match Captured" value={risk.tspMatchCaptured ? 'Yes' : 'No'} />
      </SummaryCard>

      {/* Save button (write permission only) */}
      {grant.permission === 'write' && (
        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={viewState === 'saving'}
            className="w-full bg-fortress-navy text-white py-2 rounded-md font-medium
              hover:bg-fortress-navy/90 disabled:opacity-50 transition-colors"
          >
            {viewState === 'saving' ? 'Saving...' : 'Save Snapshot'}
          </button>
          {saveMessage && (
            <p className={`text-sm mt-2 text-center ${saveMessage.includes('success') ? 'text-fortress-green' : 'text-fortress-red'}`}>
              {saveMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// --- Helper components ---

function SummaryCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h4 className="text-sm font-semibold uppercase tracking-wider text-fortress-slate mb-3">
        {title}
      </h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-100">
      <span className="text-sm font-semibold text-fortress-navy">{label}</span>
      <span className="text-sm font-bold text-fortress-navy">{value}</span>
    </div>
  );
}
