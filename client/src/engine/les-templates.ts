/**
 * LES field extraction templates — pure function.
 *
 * Extracts financial fields from raw LES text using regex patterns.
 * Computes confidence scores based on extraction method, pattern quality,
 * and value range validation.
 *
 * No side effects, no DOM, no Worker — fully testable with plain strings.
 */

import type { LESFieldResult } from '@fortress/types';

// --- Template types ---

interface LESFieldTemplate {
  field: string;
  patterns: RegExp[];
  validRange: [number, number];
}

// --- Field template registry ---

const TEMPLATES: LESFieldTemplate[] = [
  {
    field: 'basePay',
    patterns: [
      /BASE\s*PAY[:\s]*\$?\s*([\d,]+\.?\d*)/i,
      /BASIC\s*PAY[:\s]*\$?\s*([\d,]+\.?\d*)/i,
    ],
    validRange: [1000, 25000],
  },
  {
    field: 'bah',
    patterns: [
      /\bBAH[:\s]*\$?\s*([\d,]+\.?\d*)/i,
      /HOUSING\s*ALLOW(?:ANCE)?[:\s]*\$?\s*([\d,]+\.?\d*)/i,
      /BAH\s*(?:W\/O?\s*DEP|W\/\s*DEP)[:\s]*\$?\s*([\d,]+\.?\d*)/i,
    ],
    validRange: [0, 5000],
  },
  {
    field: 'bas',
    patterns: [
      /\bBAS[:\s]*\$?\s*([\d,]+\.?\d*)/i,
      /SUBSISTENCE[:\s]*\$?\s*([\d,]+\.?\d*)/i,
    ],
    validRange: [0, 500],
  },
  {
    field: 'cola',
    patterns: [
      /\bCOLA[:\s]*\$?\s*([\d,]+\.?\d*)/i,
      /COST\s*(?:OF\s*)?LIVING[:\s]*\$?\s*([\d,]+\.?\d*)/i,
    ],
    validRange: [0, 2000],
  },
  {
    field: 'federalTax',
    patterns: [
      /FED(?:ERAL)?\s*(?:TAX|W\/H|WITHHOLD(?:ING)?)[:\s]*\$?\s*([\d,]+\.?\d*)/i,
      /FIT[:\s]*\$?\s*([\d,]+\.?\d*)/i,
    ],
    validRange: [0, 10000],
  },
  {
    field: 'stateTax',
    patterns: [
      /STATE\s*(?:TAX|W\/H|WITHHOLD(?:ING)?)[:\s]*\$?\s*([\d,]+\.?\d*)/i,
      /SIT[:\s]*\$?\s*([\d,]+\.?\d*)/i,
    ],
    validRange: [0, 5000],
  },
  {
    field: 'fica',
    patterns: [
      /\bFICA[:\s]*\$?\s*([\d,]+\.?\d*)/i,
      /SOC(?:IAL)?\s*SEC(?:URITY)?[:\s]*\$?\s*([\d,]+\.?\d*)/i,
      /OASDI[:\s]*\$?\s*([\d,]+\.?\d*)/i,
    ],
    validRange: [0, 3000],
  },
  {
    field: 'sgli',
    patterns: [
      /\bSGLI[:\s]*\$?\s*([\d,]+\.?\d*)/i,
    ],
    validRange: [0, 50],
  },
  {
    field: 'tspContribution',
    patterns: [
      /\bTSP[:\s]*\$?\s*([\d,]+\.?\d*)/i,
      /THRIFT\s*(?:SAVINGS)?[:\s]*\$?\s*([\d,]+\.?\d*)/i,
    ],
    validRange: [0, 5000],
  },
  {
    field: 'allotments',
    patterns: [
      /ALLOT(?:MENT)?S?\s*(?:TOTAL)?[:\s]*\$?\s*([\d,]+\.?\d*)/i,
      /TOTAL\s*ALLOT(?:MENT)?S?[:\s]*\$?\s*([\d,]+\.?\d*)/i,
    ],
    validRange: [0, 10000],
  },
];

// --- Helpers ---

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[$,\s]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function computeRangeScore(value: number, [min, max]: [number, number]): number {
  if (value >= min && value <= max) return 1.0;
  // Within 2× the range — partially valid
  const expandedMin = Math.max(0, min - (max - min));
  const expandedMax = max + (max - min);
  if (value >= expandedMin && value <= expandedMax) return 0.6;
  return 0.3;
}

// --- Public API ---

/**
 * Extract financial fields from raw LES text.
 * Pure function — safe to call anywhere.
 *
 * @param rawText - The text content from the LES (via text layer or OCR)
 * @param extractionMethod - How the text was obtained (affects base confidence)
 * @returns Array of extracted fields with confidence scores
 */
export function extractLESFields(
  rawText: string,
  extractionMethod: 'text_layer' | 'ocr',
): LESFieldResult[] {
  if (!rawText || rawText.trim().length === 0) return [];

  const baseConfidence = extractionMethod === 'text_layer' ? 0.95 : 0.80;
  const results: LESFieldResult[] = [];

  for (const template of TEMPLATES) {
    let matched = false;

    for (let i = 0; i < template.patterns.length; i++) {
      const pattern = template.patterns[i];
      const match = rawText.match(pattern);

      if (match && match[1]) {
        const value = parseAmount(match[1]);
        if (value === 0) continue; // Skip zero-value matches

        const patternScore = i === 0 ? 1.0 : 0.85; // First pattern = preferred
        const rangeScore = computeRangeScore(value, template.validRange);
        const confidence = Math.round(baseConfidence * patternScore * rangeScore * 100) / 100;

        results.push({
          field: template.field,
          value,
          confidence,
          source: extractionMethod,
          rawMatch: match[0],
        });

        matched = true;
        break; // Use first matching pattern
      }
    }

    // If no pattern matched, skip this field (don't add it)
    if (!matched) continue;
  }

  return results;
}

/**
 * Check if raw text likely contains LES financial content.
 * Used by the worker to decide between text layer and OCR fallback.
 */
export function isLikelyLESText(rawText: string): boolean {
  if (rawText.length < 200) return false;

  const keywords = [
    /BASE\s*PAY/i,
    /BAH/i,
    /BAS/i,
    /ENTITLE/i,
    /DEDUCT/i,
    /ALLOT/i,
    /LEAVE/i,
    /EARNINGS/i,
  ];

  const matchCount = keywords.filter((kw) => kw.test(rawText)).length;
  return matchCount >= 3;
}
