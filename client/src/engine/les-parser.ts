/**
 * LES Parser — main thread API.
 *
 * Orchestrates PDF processing by:
 * 1. Reading the file as ArrayBuffer
 * 2. Spawning les-worker.ts (Web Worker)
 * 3. Relaying progress messages
 * 4. Running field extraction (les-templates) on the result
 * 5. Returning a full LESParseResult
 *
 * The PDF file never leaves the client — transferred to worker via zero-copy.
 */

import type { LESParseResult, LESProgress } from '@fortress/types';
import { extractLESFields } from './les-templates';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

/**
 * Parse a PDF file to extract LES financial fields.
 *
 * @param file - PDF File from drag-drop or file input
 * @param onProgress - Optional callback for progress updates
 * @returns Parsed LES result with extracted fields and confidence scores
 */
export async function parseLES(
  file: File,
  onProgress?: (progress: LESProgress) => void,
): Promise<LESParseResult> {
  // --- Validate input ---
  if (!file) {
    throw new Error('No file provided');
  }
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    throw new Error('Only PDF files are supported. Please select your LES as a PDF.');
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File is too large (max 20 MB). Please check that you selected the correct file.');
  }
  if (file.size === 0) {
    throw new Error('File is empty. Please select a valid PDF.');
  }

  // --- Read file ---
  onProgress?.({ stage: 'loading', percent: 5, message: 'Reading file…' });
  const buffer = await file.arrayBuffer();

  // --- Spawn worker ---
  const worker = new Worker(
    new URL('./les-worker.ts', import.meta.url),
    { type: 'module' },
  );

  try {
    const result = await new Promise<{
      rawText: string;
      extractionMethod: 'text_layer' | 'ocr';
      pageCount: number;
    }>((resolve, reject) => {
      worker.onmessage = (event) => {
        const msg = event.data;
        switch (msg.type) {
          case 'progress':
            onProgress?.(msg.data);
            break;
          case 'result':
            resolve(msg.data);
            break;
          case 'error':
            reject(new Error(msg.message));
            break;
        }
      };

      worker.onerror = (err) => {
        reject(new Error(err.message || 'Worker failed unexpectedly'));
      };

      // Transfer buffer (zero-copy) to worker
      worker.postMessage({ type: 'parse', buffer }, [buffer]);
    });

    // --- Extract fields ---
    onProgress?.({ stage: 'extracting', percent: 95, message: 'Matching financial fields…' });
    const fields = extractLESFields(result.rawText, result.extractionMethod);

    onProgress?.({ stage: 'done', percent: 100, message: 'Extraction complete' });

    return {
      fields,
      rawText: result.rawText,
      extractionMethod: result.extractionMethod,
      pageCount: result.pageCount,
    };
  } finally {
    worker.terminate();
  }
}
