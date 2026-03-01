/**
 * Black Box types.
 *
 * Encrypted emergency financial sheet for next-of-kin access.
 * Contains financial logistics only — NO balances, NO credentials.
 * Tier 5 data: encrypted blob that the server cannot decrypt.
 */

// ---------------------------------------------------------------------------
// Content (encrypted client-side, server never sees plaintext)
// ---------------------------------------------------------------------------

export type BlackBoxCategory = 'account' | 'insurance' | 'bill' | 'contact' | 'document';

export interface BlackBoxEntry {
  id: string;
  label: string;                          // e.g. "USAA Checking"
  category: BlackBoxCategory;
  details: string;                        // e.g. "Acct ending 4521, routing 314074269"
  notes?: string;
}

export interface BlackBoxContent {
  entries: BlackBoxEntry[];
  ownerName?: string;
  updatedAt: string;                      // ISO timestamp
}

// ---------------------------------------------------------------------------
// Grant / status (stored as plaintext metadata alongside encrypted blob)
// ---------------------------------------------------------------------------

export interface BlackBoxStatus {
  exists: boolean;
  contactName: string | null;
  contactEmail: string | null;
  expiresAt: string | null;               // ISO timestamp or null (no expiry)
  createdAt: string | null;
  updatedAt: string | null;
}
