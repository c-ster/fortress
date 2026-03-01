/**
 * Black Box emergency access page.
 *
 * Public route (no auth required). Emergency contact enters
 * access token + access key to decrypt and view the Black Box.
 */

import { useState } from 'react';
import { BlackBoxViewer } from '../components/blackbox/BlackBoxViewer';
import { loadBlackBoxByToken } from '../crypto/blackbox-api';
import { decryptBlackBox } from '../crypto/blackbox-crypto';
import type { BlackBoxContent } from '@fortress/types';

type View = 'input' | 'loading' | 'decrypted' | 'error';

export function BlackBoxAccessPage() {
  const [view, setView] = useState<View>('input');
  const [token, setToken] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [content, setContent] = useState<BlackBoxContent | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!token.trim() || !accessKey.trim()) {
      setError('Both access token and access key are required.');
      return;
    }

    setView('loading');
    setError('');

    try {
      const payload = await loadBlackBoxByToken(token.trim());
      if (!payload) {
        setError('Black Box not found, expired, or access has been revoked.');
        setView('error');
        return;
      }

      const decrypted = await decryptBlackBox(payload, accessKey);
      setContent(decrypted);
      setView('decrypted');
    } catch {
      setError('Failed to decrypt. Check your access key and try again.');
      setView('error');
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <span className="text-3xl">&#128274;</span>
        <h2 className="text-2xl font-bold text-fortress-navy mt-2">
          Emergency Access
        </h2>
        <p className="text-gray-500 mt-1 text-sm">
          Enter the access token and access key provided by the service member.
        </p>
      </div>

      {/* Input form */}
      {(view === 'input' || view === 'error') && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-fortress-red">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label
                htmlFor="bb-token"
                className="block text-sm font-medium text-fortress-slate mb-1"
              >
                Access Token <span className="text-fortress-red">*</span>
              </label>
              <textarea
                id="bb-token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                rows={3}
                placeholder="Paste the 64-character access token here"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                  font-mono placeholder:text-gray-300 focus:border-fortress-navy
                  focus:ring-1 focus:ring-fortress-navy"
              />
            </div>

            <div>
              <label
                htmlFor="bb-key"
                className="block text-sm font-medium text-fortress-slate mb-1"
              >
                Access Key <span className="text-fortress-red">*</span>
              </label>
              <input
                id="bb-key"
                type="password"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                placeholder="Enter the access key"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                  placeholder:text-gray-300 focus:border-fortress-navy
                  focus:ring-1 focus:ring-fortress-navy"
              />
              <p className="text-xs text-gray-400 mt-1">
                The passphrase the service member chose when creating the Black Box.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              className="w-full bg-fortress-navy text-white py-2.5 rounded-md font-medium
                hover:bg-fortress-navy/90 transition-colors"
            >
              Decrypt &amp; View
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center mt-4">
            This page does not require a Fortress account.
            All decryption happens in your browser.
          </p>
        </div>
      )}

      {/* Loading */}
      {view === 'loading' && (
        <div className="text-center py-12">
          <p className="text-sm text-gray-400">Decrypting&hellip;</p>
        </div>
      )}

      {/* Decrypted content */}
      {view === 'decrypted' && content && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <BlackBoxViewer content={content} />

          <div className="mt-6 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => {
                setContent(null);
                setToken('');
                setAccessKey('');
                setView('input');
              }}
              className="w-full border border-gray-300 text-gray-600 py-2 rounded-md
                text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Clear &amp; Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
