import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, DecryptionError } from '../../src/crypto/crypto';
import type { FinancialState, PayGrade, EncryptedPayload } from '@fortress/types';

const PASSPHRASE = 'test-passphrase-for-fortress';
const BASE64_RE = /^[A-Za-z0-9+/]+=*$/;

function makeState(): FinancialState {
  return {
    income: {
      basePay: 3000, bah: 1500, bas: 400, cola: 100, specialPay: 200, otherIncome: 50,
      totalGross: 5250, totalTaxable: 3250, totalNonTaxable: 2000,
    },
    deductions: {
      federalTax: 450, stateTax: 120, fica: 230, sgli: 25, sgliCoverage: 500000,
      tspTraditional: 150, tspRoth: 0, tspContributionPct: 0.05,
      tricare: 0, otherDeductions: 0, allotments: [],
    },
    expenses: {
      housing: 1200, utilities: 150, transportation: 300, food: 400,
      childcare: 0, insurance: 100, subscriptions: 50, discretionary: 200,
      totalEssential: 2150, totalMonthly: 2400,
    },
    debts: [
      {
        id: 'debt-1', name: 'Credit Card', type: 'credit_card',
        balance: 5000, apr: 22, minimumPayment: 150, monthlyPayment: 200,
        preService: false,
      },
    ],
    assets: {
      checkingBalance: 500, savingsBalance: 2000, emergencyFund: 2000,
      tspBalance: 8500, otherInvestments: 0, totalLiquid: 2500,
    },
    military: {
      payGrade: 'E5' as PayGrade, yearsOfService: 4, dependents: 2,
      dutyStation: '92101', component: 'active', retirementSystem: 'brs',
      scraEligible: false,
    },
    risk: {
      emergencyFundMonths: 0.93, debtToIncomeRatio: 0.038,
      highInterestDebtTotal: 5000, sgliAdequate: true,
      tspMatchCaptured: true, scraOpportunity: 0, paydaySpikeSeverity: 0,
    },
    meta: {
      dataSource: 'manual', lastUpdated: '2025-01-15T12:00:00Z',
      completeness: 0.9, confidenceScores: {},
    },
  };
}

describe('encrypt / decrypt', () => {
  it('round-trips plaintext correctly', async () => {
    const plaintext = 'Hello, Fortress!';
    const payload = await encrypt(plaintext, PASSPHRASE);
    const result = await decrypt(payload, PASSPHRASE);
    expect(result).toBe(plaintext);
  });

  it('round-trips a full FinancialState JSON', async () => {
    const state = makeState();
    const json = JSON.stringify(state);
    const payload = await encrypt(json, PASSPHRASE);
    const result = await decrypt(payload, PASSPHRASE);
    expect(JSON.parse(result)).toEqual(state);
  });

  it('round-trips an empty string', async () => {
    const payload = await encrypt('', PASSPHRASE);
    const result = await decrypt(payload, PASSPHRASE);
    expect(result).toBe('');
  });

  it('throws DecryptionError on wrong passphrase', async () => {
    const payload = await encrypt('secret data', PASSPHRASE);
    await expect(decrypt(payload, 'wrong-passphrase')).rejects.toThrow(DecryptionError);
  });

  it('produces different ciphertext for the same plaintext (random IV/salt)', async () => {
    const plaintext = 'same data';
    const a = await encrypt(plaintext, PASSPHRASE);
    const b = await encrypt(plaintext, PASSPHRASE);

    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.iv).not.toBe(b.iv);
    expect(a.salt).not.toBe(b.salt);
  });

  it('preserves schemaVersion = 1', async () => {
    const payload = await encrypt('data', PASSPHRASE);
    expect(payload.schemaVersion).toBe(1);
  });

  it('preserves iterations = 600000', async () => {
    const payload = await encrypt('data', PASSPHRASE);
    expect(payload.iterations).toBe(600_000);
  });

  it('returns valid Base64 in all string fields', async () => {
    const payload = await encrypt('test data for base64', PASSPHRASE);
    expect(payload.ciphertext).toMatch(BASE64_RE);
    expect(payload.iv).toMatch(BASE64_RE);
    expect(payload.authTag).toMatch(BASE64_RE);
    expect(payload.salt).toMatch(BASE64_RE);
  });

  it('throws DecryptionError on corrupted ciphertext', async () => {
    const payload = await encrypt('data', PASSPHRASE);
    // Flip a character in the ciphertext
    const corrupted: EncryptedPayload = {
      ...payload,
      ciphertext: payload.ciphertext.slice(0, -2) + 'AA',
    };
    await expect(decrypt(corrupted, PASSPHRASE)).rejects.toThrow(DecryptionError);
  });

  it('throws DecryptionError on corrupted authTag', async () => {
    const payload = await encrypt('data', PASSPHRASE);
    const corrupted: EncryptedPayload = {
      ...payload,
      authTag: payload.authTag.slice(0, -2) + 'AA',
    };
    await expect(decrypt(corrupted, PASSPHRASE)).rejects.toThrow(DecryptionError);
  });

  it('throws DecryptionError on unsupported schema version', async () => {
    const payload = await encrypt('data', PASSPHRASE);
    const future: EncryptedPayload = { ...payload, schemaVersion: 99 };
    await expect(decrypt(future, PASSPHRASE)).rejects.toThrow(DecryptionError);
    await expect(decrypt(future, PASSPHRASE)).rejects.toThrow('Unsupported schema version');
  });
});
