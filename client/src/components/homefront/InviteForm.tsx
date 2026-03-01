import { useState, type FormEvent } from 'react';
import { FormSection } from '../shared/FormSection';
import { TextInput } from '../shared/TextInput';
import { SelectInput } from '../shared/SelectInput';
import type { InviteResult } from '../../hooks/useHomefront';

interface InviteFormProps {
  onInvite: (spouseEmail: string, permission: 'read' | 'write') => Promise<boolean>;
  inviteResult: InviteResult | null;
  isLoading: boolean;
  error: string | null;
}

const PERMISSION_OPTIONS = [
  { value: 'read', label: 'View Only' },
  { value: 'write', label: 'View & Edit' },
];

export function InviteForm({ onInvite, inviteResult, isLoading, error }: InviteFormProps) {
  const [spouseEmail, setSpouseEmail] = useState('');
  const [permission, setPermission] = useState('read');
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!spouseEmail.includes('@')) return;
    await onInvite(spouseEmail, permission as 'read' | 'write');
  };

  const inviteUrl = inviteResult
    ? `${window.location.origin}/homefront/accept?token=${inviteResult.inviteToken}`
    : null;

  const handleCopy = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <FormSection title="Send Invite" description="Invite your spouse to view your financial snapshot.">
        <form onSubmit={handleSubmit} className="space-y-4">
          <TextInput
            label="Spouse Email"
            value={spouseEmail}
            onChange={setSpouseEmail}
            placeholder="spouse@email.com"
            required
          />
          <SelectInput
            label="Permission Level"
            value={permission}
            onChange={setPermission}
            options={PERMISSION_OPTIONS}
            helpText="'View & Edit' allows your spouse to update your financial data."
          />

          {error && (
            <div className="text-sm text-fortress-red bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !spouseEmail.includes('@')}
            className="w-full bg-fortress-navy text-white py-2 rounded-md font-medium
              hover:bg-fortress-navy/90 disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors"
          >
            {isLoading ? 'Sending...' : 'Create Invite Link'}
          </button>
        </form>
      </FormSection>

      {inviteUrl && (
        <div className="bg-fortress-green/10 border border-fortress-green/30 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-fortress-navy mb-2">Invite Created</h4>
          <div className="bg-white rounded border border-gray-200 p-2 mb-3">
            <code className="text-xs break-all text-gray-700">{inviteUrl}</code>
          </div>
          <button
            onClick={handleCopy}
            className="text-sm font-medium text-fortress-navy hover:underline"
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <p className="text-xs text-gray-500 mt-2">
            Expires: {new Date(inviteResult!.expiresAt).toLocaleString()}
          </p>
          <p className="text-xs text-fortress-navy/70 mt-1 font-medium">
            Your spouse will also need your encryption passphrase to view the data.
            Share it securely (in person or by phone).
          </p>
        </div>
      )}
    </div>
  );
}
