import { useState, useCallback, type FormEvent } from 'react';
import { config } from '../../config';
import { useAuthStore } from '../../stores/auth';
import { buildPdfContent } from '../../engine/pdf-generator';
import { renderSummaryPdf } from '../../services/pdf-renderer';
import type { FinancialState, RiskAssessment, ActionPlan } from '@fortress/types';

interface ReferralModalProps {
  state: FinancialState;
  assessment: RiskAssessment;
  actionPlan: ActionPlan;
  onClose: () => void;
}

type ModalState = 'form' | 'sending' | 'success' | 'error';

export function ReferralModal({ state, assessment, actionPlan, onClose }: ReferralModalProps) {
  const accessToken = useAuthStore((s) => s.accessToken);

  const [counselorEmail, setCounselorEmail] = useState('');
  const [message, setMessage] = useState('');
  const [modalState, setModalState] = useState<ModalState>('form');
  const [errorMsg, setErrorMsg] = useState('');

  const canSend = counselorEmail.includes('@') && counselorEmail.includes('.');

  const handleSend = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!canSend) return;

      setModalState('sending');
      setErrorMsg('');

      try {
        // Generate PDF client-side
        const content = buildPdfContent(state, assessment, actionPlan);
        const doc = renderSummaryPdf(content);
        const arrayBuf = doc.output('arraybuffer');
        const pdfBase64 = btoa(
          new Uint8Array(arrayBuf).reduce((data, byte) => data + String.fromCharCode(byte), ''),
        );

        const res = await fetch(`${config.apiUrl}/referral/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          credentials: 'include',
          body: JSON.stringify({
            counselorEmail: counselorEmail.trim(),
            message: message.trim() || undefined,
            pdfBase64,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({ message: 'Failed to send email' }));
          throw new Error(data.message || `Server error (${res.status})`);
        }

        setModalState('success');
        setTimeout(onClose, 3000);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'An unexpected error occurred');
        setModalState('error');
      }
    },
    [canSend, state, assessment, actionPlan, accessToken, counselorEmail, message, onClose],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true" aria-labelledby="referral-modal-title">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 id="referral-modal-title" className="text-lg font-semibold text-fortress-navy">Email Summary to Counselor</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {modalState === 'success' ? (
            <div className="bg-green-50 border border-fortress-green/30 rounded-lg p-4 text-center">
              <span className="text-fortress-green text-2xl font-bold">&#10003;</span>
              <p className="text-sm text-green-800 mt-2">
                Summary sent to <strong>{counselorEmail}</strong>
              </p>
              <p className="text-xs text-gray-500 mt-1">This dialog will close automatically.</p>
            </div>
          ) : (
            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <label htmlFor="counselor-email" className="block text-sm font-medium text-fortress-slate mb-1">
                  Counselor Email <span className="text-fortress-red">*</span>
                </label>
                <input
                  id="counselor-email"
                  type="email"
                  value={counselorEmail}
                  onChange={(e) => setCounselorEmail(e.target.value)}
                  placeholder="pfc@installation.mil"
                  disabled={modalState === 'sending'}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-fortress-slate
                    focus:border-fortress-navy focus:ring-1 focus:ring-fortress-navy outline-none
                    disabled:bg-gray-100 disabled:text-gray-400"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  Your PFC or Military OneSource advisor's email address.
                </p>
              </div>

              <div>
                <label htmlFor="referral-message" className="block text-sm font-medium text-fortress-slate mb-1">
                  Personal Message <span className="text-xs text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  id="referral-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Add context for your counselor..."
                  maxLength={500}
                  rows={3}
                  disabled={modalState === 'sending'}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-fortress-slate
                    focus:border-fortress-navy focus:ring-1 focus:ring-fortress-navy outline-none resize-none
                    disabled:bg-gray-100 disabled:text-gray-400"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{message.length}/500</p>
              </div>

              {modalState === 'error' && (
                <div className="text-sm text-fortress-red bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {errorMsg}
                </div>
              )}

              <p className="text-xs text-gray-500 leading-relaxed">
                Your Financial Readiness Summary PDF will be generated and sent as an email attachment.
                The counselor can reply directly to your email.
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={modalState === 'sending'}
                  className="flex-1 border border-gray-300 text-fortress-slate px-4 py-2 rounded-md
                    text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSend || modalState === 'sending'}
                  className="flex-1 bg-fortress-navy text-white px-4 py-2 rounded-md text-sm font-medium
                    hover:bg-fortress-navy/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {modalState === 'sending' ? 'Sending...' : 'Send Email'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
