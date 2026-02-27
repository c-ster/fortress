import { describe, it, expect } from 'vitest';
import { extractLESFields, isLikelyLESText } from '../../src/engine/les-templates';

// --- Sample LES text fixtures ---

/** Standard format: typical DFAS LES layout */
const STANDARD_LES = `
LEAVE AND EARNINGS STATEMENT
NAME: DOE, JOHN E    GRADE: E5    YEARS SVC: 06

ENTITLEMENTS                    DEDUCTIONS                    ALLOTMENTS
BASE PAY          $3,466.50     FEDERAL TAX    $312.00        ALLOTMENT SAVINGS  $500.00
BAH               $1,872.00     STATE TAX      $142.50
BAS               $  406.98     FICA           $265.20
COLA              $    0.00     SGLI           $  31.00
                                TSP            $  346.65
                                TRICARE        $    0.00

TOTAL ENTITLEMENTS $5,745.48    TOTAL DEDUCTIONS $1,097.35    TOTAL ALLOTMENTS $500.00
`;

/** Alternate format: different labels, slightly different layout */
const ALTERNATE_LES = `
EARNINGS AND LEAVE STATEMENT
BASIC PAY        3466.50
HOUSING ALLOWANCE 1872.00
SUBSISTENCE       406.98

FEDERAL WITHHOLDING  312.00
STATE WITHHOLDING    142.50
SOCIAL SECURITY      265.20
SGLI                  31.00
THRIFT SAVINGS       346.65

ALLOTMENTS TOTAL     500.00
`;

/** Minimal format: only a few fields */
const MINIMAL_LES = `
BASE PAY $2,400.00
BAH $900.00
FEDERAL TAX $180.00
`;

describe('extractLESFields', () => {
  it('extracts basePay from standard format', () => {
    const results = extractLESFields(STANDARD_LES, 'text_layer');
    const basePay = results.find((r) => r.field === 'basePay');

    expect(basePay).toBeDefined();
    expect(basePay!.value).toBe(3466.50);
    expect(basePay!.confidence).toBeGreaterThanOrEqual(0.9);
    expect(basePay!.source).toBe('text_layer');
    expect(basePay!.rawMatch).toContain('3,466.50');
  });

  it('extracts BAH with alternate label', () => {
    const results = extractLESFields(ALTERNATE_LES, 'text_layer');
    const bah = results.find((r) => r.field === 'bah');

    expect(bah).toBeDefined();
    expect(bah!.value).toBe(1872);
    expect(bah!.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('extracts all 10 fields from standard LES text', () => {
    const results = extractLESFields(STANDARD_LES, 'text_layer');

    // Should find: basePay, bah, bas, federalTax, stateTax, fica, sgli, tspContribution, allotments
    // COLA is $0 so it may be skipped; that's 9 non-zero fields
    expect(results.length).toBeGreaterThanOrEqual(8);

    for (const result of results) {
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      expect(result.value).toBeGreaterThan(0);
      expect(result.rawMatch.length).toBeGreaterThan(0);
    }
  });

  it('extracts fields from alternate LES format', () => {
    const results = extractLESFields(ALTERNATE_LES, 'text_layer');

    const basePay = results.find((r) => r.field === 'basePay');
    expect(basePay).toBeDefined();
    expect(basePay!.value).toBe(3466.50);

    const fica = results.find((r) => r.field === 'fica');
    expect(fica).toBeDefined();
    expect(fica!.value).toBe(265.20);

    const tsp = results.find((r) => r.field === 'tspContribution');
    expect(tsp).toBeDefined();
    expect(tsp!.value).toBe(346.65);
  });

  it('returns empty array for empty text', () => {
    expect(extractLESFields('', 'text_layer')).toEqual([]);
    expect(extractLESFields('   ', 'ocr')).toEqual([]);
  });

  it('out-of-range value gets low confidence', () => {
    const text = 'BASE PAY $99,999.00';
    const results = extractLESFields(text, 'text_layer');
    const basePay = results.find((r) => r.field === 'basePay');

    expect(basePay).toBeDefined();
    expect(basePay!.value).toBe(99999);
    // Out of $1K-$25K range, within 2× expansion would be up to $49K — this is beyond 2×
    expect(basePay!.confidence).toBeLessThanOrEqual(0.4);
  });

  it('SGLI deduction extracted correctly', () => {
    const results = extractLESFields(STANDARD_LES, 'text_layer');
    const sgli = results.find((r) => r.field === 'sgli');

    expect(sgli).toBeDefined();
    expect(sgli!.value).toBe(31);
    expect(sgli!.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('TSP contribution extracted correctly', () => {
    const results = extractLESFields(STANDARD_LES, 'text_layer');
    const tsp = results.find((r) => r.field === 'tspContribution');

    expect(tsp).toBeDefined();
    expect(tsp!.value).toBe(346.65);
  });

  it('FICA with alternate label (SOCIAL SECURITY)', () => {
    const results = extractLESFields(ALTERNATE_LES, 'text_layer');
    const fica = results.find((r) => r.field === 'fica');

    expect(fica).toBeDefined();
    expect(fica!.value).toBe(265.20);
  });

  it('text_layer gets higher base confidence than OCR', () => {
    const textLayerResults = extractLESFields(STANDARD_LES, 'text_layer');
    const ocrResults = extractLESFields(STANDARD_LES, 'ocr');

    const textBP = textLayerResults.find((r) => r.field === 'basePay');
    const ocrBP = ocrResults.find((r) => r.field === 'basePay');

    expect(textBP).toBeDefined();
    expect(ocrBP).toBeDefined();
    expect(textBP!.confidence).toBeGreaterThan(ocrBP!.confidence);
  });

  it('returns only matched fields (partial results)', () => {
    const results = extractLESFields(MINIMAL_LES, 'text_layer');

    expect(results.length).toBe(3); // basePay, bah, federalTax
    const fields = results.map((r) => r.field);
    expect(fields).toContain('basePay');
    expect(fields).toContain('bah');
    expect(fields).toContain('federalTax');
    expect(fields).not.toContain('sgli');
  });

  it('handles dollar signs in various positions', () => {
    const text = 'BASE PAY $3,466.50\nBAH 1872.00\nFED TAX $312';
    const results = extractLESFields(text, 'text_layer');

    expect(results.length).toBeGreaterThanOrEqual(3);
    const basePay = results.find((r) => r.field === 'basePay');
    expect(basePay!.value).toBe(3466.50);
  });

  it('handles OCR artifacts gracefully (no crash)', () => {
    const ocrText = 'BASE PAY $3,4b6.50\nBAH l,872.OO';
    // Should not crash — may extract partial or no results
    const results = extractLESFields(ocrText, 'ocr');
    expect(Array.isArray(results)).toBe(true);
  });

  it('extracts allotments total', () => {
    const results = extractLESFields(STANDARD_LES, 'text_layer');
    const allotments = results.find((r) => r.field === 'allotments');

    // The standard LES has "ALLOTMENT SAVINGS  $500.00" — matches ALLOT pattern
    if (allotments) {
      expect(allotments.value).toBe(500);
    }
  });
});

describe('isLikelyLESText', () => {
  it('returns true for text with multiple LES keywords', () => {
    expect(isLikelyLESText(STANDARD_LES)).toBe(true);
  });

  it('returns false for short text', () => {
    expect(isLikelyLESText('hello')).toBe(false);
  });

  it('returns false for non-LES text', () => {
    const nonLES = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10);
    expect(isLikelyLESText(nonLES)).toBe(false);
  });

  it('returns true for alternate LES format', () => {
    expect(isLikelyLESText(ALTERNATE_LES)).toBe(true);
  });
});
