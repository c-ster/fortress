/**
 * Black Box owner page.
 *
 * State machine: loading → empty | status | editing
 * After save: shows one-time access token modal.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/auth';
import { BlackBoxForm } from '../components/blackbox/BlackBoxForm';
import { BlackBoxStatusCard } from '../components/blackbox/BlackBoxStatus';
import { encryptBlackBox } from '../crypto/blackbox-crypto';
import {
  saveBlackBox,
  deleteBlackBox,
  getBlackBoxStatus,
} from '../crypto/blackbox-api';
import type { BlackBoxStatus, BlackBoxEntry, BlackBoxContent } from '@fortress/types';

type View = 'loading' | 'empty' | 'status' | 'editing';

export function BlackBoxPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [view, setView] = useState<View>('loading');
  const [status, setStatus] = useState<BlackBoxStatus | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [generatedToken, setGeneratedToken] = useState('');
  const [copied, setCopied] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!accessToken) return;
    try {
      const s = await getBlackBoxStatus(accessToken);
      setStatus(s);
      setView(s.exists ? 'status' : 'empty');
    } catch {
      setError('Failed to load Black Box status.');
      setView('empty');
    }
  }, [accessToken]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleSave = async (
    entries: BlackBoxEntry[],
    ownerName: string,
    contactName: string,
    contactEmail: string,
    accessKey: string,
    expiresAt?: string,
  ) => {
    if (!accessToken) return;
    setIsSaving(true);
    setError('');

    try {
      const content: BlackBoxContent = {
        entries,
        ownerName,
        updatedAt: new Date().toISOString(),
      };

      const encrypted = await encryptBlackBox(content, accessKey);

      const result = await saveBlackBox(
        encrypted,
        { contactName, contactEmail, expiresAt },
        accessToken,
      );

      setGeneratedToken(result.accessToken);
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save Black Box.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!accessToken) return;
    setIsDeleting(true);
    try {
      await deleteBlackBox(accessToken);
      setStatus(null);
      setView('empty');
    } catch {
      setError('Failed to delete Black Box.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(generatedToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-fortress-navy">Black Box</h2>
        <p className="text-gray-500 mt-1">
          Encrypted emergency financial sheet for your designated next-of-kin.
          Contains financial logistics only &mdash; no balances, no credentials.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-fortress-red/30 rounded-lg p-3 mb-4">
          <p className="text-sm text-fortress-red">{error}</p>
        </div>
      )}

      {/* Access token modal */}
      {generatedToken && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="text-center mb-4">
              <span className="text-3xl">&#128272;</span>
              <h3 className="text-lg font-bold text-fortress-navy mt-2">
                Access Token Generated
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Share this token with your emergency contact. It will only be shown once.
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-gray-400 mb-1 font-medium">ACCESS TOKEN</p>
              <p className="text-xs font-mono text-fortress-slate break-all leading-relaxed">
                {generatedToken}
              </p>
            </div>

            <button
              type="button"
              onClick={handleCopyToken}
              className="w-full bg-fortress-navy text-white py-2 rounded-md text-sm font-medium
                hover:bg-fortress-navy/90 transition-colors mb-2"
            >
              {copied ? 'Copied!' : 'Copy Token'}
            </button>

            <p className="text-xs text-gray-400 text-center mb-3">
              Your contact will also need the <strong>access key</strong> you set to decrypt the sheet.
            </p>

            <button
              type="button"
              onClick={() => setGeneratedToken('')}
              className="w-full border border-gray-300 text-gray-600 py-2 rounded-md text-sm
                font-medium hover:bg-gray-50 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {view === 'loading' && (
        <div className="text-center py-12">
          <p className="text-sm text-gray-400">Loading&hellip;</p>
        </div>
      )}

      {view === 'empty' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <span className="text-4xl">&#128274;</span>
          <h3 className="text-lg font-semibold text-fortress-navy mt-3">
            No Black Box Set Up
          </h3>
          <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
            Create an encrypted emergency sheet with your account locations,
            policy numbers, and bill due dates. Your designated contact can
            access it with the token and access key you provide.
          </p>
          <button
            type="button"
            onClick={() => setView('editing')}
            className="mt-4 bg-fortress-navy text-white px-6 py-2.5 rounded-md font-medium
              hover:bg-fortress-navy/90 transition-colors"
          >
            Create Black Box
          </button>
        </div>
      )}

      {view === 'status' && status && (
        <BlackBoxStatusCard
          status={status}
          onEdit={() => setView('editing')}
          onDelete={handleDelete}
          isDeleting={isDeleting}
        />
      )}

      {view === 'editing' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-fortress-navy uppercase tracking-wider">
              {status?.exists ? 'Edit Black Box' : 'Create Black Box'}
            </h3>
            {status?.exists && (
              <button
                type="button"
                onClick={() => setView('status')}
                className="text-sm text-gray-500 hover:text-fortress-navy"
              >
                Cancel
              </button>
            )}
          </div>
          <BlackBoxForm
            onSave={handleSave}
            isSaving={isSaving}
            initialContactName={status?.contactName ?? undefined}
            initialContactEmail={status?.contactEmail ?? undefined}
          />
        </div>
      )}
    </div>
  );
}
