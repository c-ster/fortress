/**
 * Black Box entry form.
 * Collects emergency financial entries, contact info, access key, and optional expiry.
 */

import { useState } from 'react';
import { FormSection } from '../shared/FormSection';
import { TextInput } from '../shared/TextInput';
import { SelectInput } from '../shared/SelectInput';
import type { BlackBoxEntry, BlackBoxCategory } from '@fortress/types';

interface BlackBoxFormProps {
  onSave: (
    entries: BlackBoxEntry[],
    ownerName: string,
    contactName: string,
    contactEmail: string,
    accessKey: string,
    expiresAt?: string,
  ) => void;
  initialEntries?: BlackBoxEntry[];
  initialOwnerName?: string;
  initialContactName?: string;
  initialContactEmail?: string;
  isSaving?: boolean;
}

const CATEGORY_OPTIONS: { value: BlackBoxCategory; label: string }[] = [
  { value: 'account', label: 'Account' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'bill', label: 'Bill / Payment' },
  { value: 'contact', label: 'Emergency Contact' },
  { value: 'document', label: 'Document' },
];

function makeEmptyEntry(): BlackBoxEntry {
  return {
    id: crypto.randomUUID(),
    label: '',
    category: 'account',
    details: '',
  };
}

export function BlackBoxForm({
  onSave,
  initialEntries,
  initialOwnerName,
  initialContactName,
  initialContactEmail,
  isSaving,
}: BlackBoxFormProps) {
  const [ownerName, setOwnerName] = useState(initialOwnerName ?? '');
  const [contactName, setContactName] = useState(initialContactName ?? '');
  const [contactEmail, setContactEmail] = useState(initialContactEmail ?? '');
  const [expiresAt, setExpiresAt] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [confirmKey, setConfirmKey] = useState('');
  const [entries, setEntries] = useState<BlackBoxEntry[]>(
    initialEntries?.length ? initialEntries : [makeEmptyEntry()],
  );
  const [error, setError] = useState('');

  const updateEntry = (id: string, partial: Partial<BlackBoxEntry>) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...partial } : e)),
    );
  };

  const removeEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const addEntry = () => {
    setEntries((prev) => [...prev, makeEmptyEntry()]);
  };

  const handleSubmit = () => {
    setError('');

    // Validate
    const validEntries = entries.filter((e) => e.label.trim() && e.details.trim());
    if (validEntries.length === 0) {
      setError('At least one entry with a label and details is required.');
      return;
    }
    if (!contactName.trim()) {
      setError('Emergency contact name is required.');
      return;
    }
    if (!contactEmail.includes('@')) {
      setError('A valid emergency contact email is required.');
      return;
    }
    if (accessKey.length < 8) {
      setError('Access key must be at least 8 characters.');
      return;
    }
    if (accessKey !== confirmKey) {
      setError('Access key and confirmation do not match.');
      return;
    }

    onSave(
      validEntries,
      ownerName.trim(),
      contactName.trim(),
      contactEmail.trim().toLowerCase(),
      accessKey,
      expiresAt || undefined,
    );
  };

  return (
    <div className="space-y-4">
      {/* Owner name */}
      <FormSection title="Your Info" description="Identifies this emergency sheet.">
        <TextInput
          label="Your Name"
          value={ownerName}
          onChange={setOwnerName}
          placeholder="e.g. SSG John Smith"
          helpText="Displayed at the top of the emergency sheet"
        />
      </FormSection>

      {/* Emergency contact */}
      <FormSection title="Emergency Contact" description="Who will receive access to this Black Box.">
        <div className="space-y-3">
          <TextInput
            label="Contact Name"
            value={contactName}
            onChange={setContactName}
            required
            placeholder="e.g. Jane Smith"
          />
          <TextInput
            label="Contact Email"
            value={contactEmail}
            onChange={setContactEmail}
            required
            placeholder="e.g. jane@example.com"
          />
        </div>
      </FormSection>

      {/* Expiry */}
      <FormSection title="Expiry (Optional)" description="Auto-expire after deployment window.">
        <TextInput
          label="Expiry Date"
          value={expiresAt}
          onChange={setExpiresAt}
          placeholder="YYYY-MM-DD"
          helpText="Leave blank for no expiry"
        />
      </FormSection>

      {/* Access key */}
      <FormSection title="Access Key" description="Your emergency contact will need this key to decrypt the sheet. Share it with them securely.">
        <div className="space-y-3">
          <TextInput
            label="Access Key"
            value={accessKey}
            onChange={setAccessKey}
            required
            placeholder="Minimum 8 characters"
          />
          <TextInput
            label="Confirm Access Key"
            value={confirmKey}
            onChange={setConfirmKey}
            required
            placeholder="Re-enter access key"
          />
        </div>
      </FormSection>

      {/* Entries */}
      <FormSection title="Financial Entries" description="Account locations, policy numbers, bill due dates, contacts. No balances or passwords.">
        <div className="space-y-3">
          {entries.map((entry, idx) => (
            <div
              key={entry.id}
              className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-400">
                  Entry {idx + 1}
                </span>
                {entries.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeEntry(entry.id)}
                    className="text-xs text-fortress-red hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <TextInput
                  label="Label"
                  value={entry.label}
                  onChange={(v) => updateEntry(entry.id, { label: v })}
                  placeholder="e.g. USAA Checking"
                />
                <SelectInput
                  label="Category"
                  value={entry.category}
                  onChange={(v) => updateEntry(entry.id, { category: v as BlackBoxCategory })}
                  options={CATEGORY_OPTIONS}
                />
              </div>
              <TextInput
                label="Details"
                value={entry.details}
                onChange={(v) => updateEntry(entry.id, { details: v })}
                placeholder="e.g. Acct ending 4521, routing 314074269"
              />
              <TextInput
                label="Notes (Optional)"
                value={entry.notes ?? ''}
                onChange={(v) => updateEntry(entry.id, { notes: v || undefined })}
                placeholder="Any extra info"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={addEntry}
            className="text-sm text-fortress-navy font-medium hover:underline"
          >
            + Add Entry
          </button>
        </div>
      </FormSection>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-fortress-red/30 rounded-lg p-3">
          <p className="text-sm text-fortress-red">{error}</p>
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSaving}
        className="w-full bg-fortress-navy text-white py-2.5 rounded-md font-medium
          hover:bg-fortress-navy/90 transition-colors disabled:opacity-50"
      >
        {isSaving ? 'Encrypting & Saving...' : 'Encrypt & Save Black Box'}
      </button>
    </div>
  );
}
