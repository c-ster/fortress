/**
 * LES PDF processing Web Worker.
 *
 * Flow:
 * 1. Receive ArrayBuffer (PDF file, transferred zero-copy)
 * 2. Lazy-import pdfjs-dist → extract text layer
 * 3. If text layer looks like LES → done (fast path)
 * 4. Else fallback: lazy-import tesseract.js → OCR via OffscreenCanvas
 * 5. Post result or error back to main thread
 *
 * The PDF never leaves the worker — zero-knowledge by design.
 */

import type { LESProgress } from '@fortress/types';

// --- Message protocol ---

interface ParseMessage {
  type: 'parse';
  buffer: ArrayBuffer;
}

interface ProgressMessage {
  type: 'progress';
  data: LESProgress;
}

interface ResultMessage {
  type: 'result';
  data: {
    rawText: string;
    extractionMethod: 'text_layer' | 'ocr';
    pageCount: number;
  };
}

interface ErrorMessage {
  type: 'error';
  message: string;
}

type OutboundMessage = ProgressMessage | ResultMessage | ErrorMessage;

function post(msg: OutboundMessage) {
  self.postMessage(msg);
}

function progress(stage: LESProgress['stage'], percent: number, message: string) {
  post({ type: 'progress', data: { stage, percent, message } });
}

// --- PDF.js text extraction ---

async function extractTextLayer(buffer: ArrayBuffer): Promise<{ text: string; pageCount: number }> {
  progress('loading', 10, 'Loading PDF library…');

  const pdfjsLib = await import('pdfjs-dist');

  // We're already in a worker — disable PDF.js internal worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = '';

  progress('loading', 20, 'Opening PDF…');

  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;

  progress('rendering', 30, `Extracting text from ${pageCount} page(s)…`);

  const textParts: string[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    textParts.push(pageText);

    const pct = 30 + Math.round((i / pageCount) * 40);
    progress('rendering', pct, `Page ${i}/${pageCount} text extracted`);
  }

  return { text: textParts.join('\n'), pageCount };
}

// --- Tesseract.js OCR fallback ---

async function extractOCR(buffer: ArrayBuffer): Promise<{ text: string; pageCount: number }> {
  progress('ocr', 50, 'Preparing OCR (this may take a moment)…');

  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '';

  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;

  // Only OCR first 3 pages max (LES is typically 1-2 pages)
  const pagesToScan = Math.min(pageCount, 3);

  progress('ocr', 55, 'Loading OCR engine…');
  const Tesseract = await import('tesseract.js');

  const textParts: string[] = [];

  for (let i = 1; i <= pagesToScan; i++) {
    progress('ocr', 55 + Math.round((i / pagesToScan) * 35), `OCR page ${i}/${pagesToScan}…`);

    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // 2× for better OCR quality

    // Use OffscreenCanvas (available in modern workers)
    const canvas = new OffscreenCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to create OffscreenCanvas context');

    await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport }).promise;

    // Convert to blob for Tesseract
    const blob = await canvas.convertToBlob({ type: 'image/png' });

    const result = await Tesseract.recognize(blob, 'eng', {
      logger: () => {}, // Suppress Tesseract logs
    });

    textParts.push(result.data.text);
  }

  return { text: textParts.join('\n'), pageCount };
}

// --- Main handler ---

self.onmessage = async (event: MessageEvent<ParseMessage>) => {
  const { type, buffer } = event.data;
  if (type !== 'parse') return;

  try {
    // Step 1: Try text layer extraction (fast path)
    const { text: rawText, pageCount } = await extractTextLayer(buffer);

    // Step 2: Check if text layer has useful financial content
    // Import les-templates inline to check text quality
    const { isLikelyLESText } = await import('./les-templates');

    if (isLikelyLESText(rawText)) {
      progress('extracting', 90, 'Text layer extraction successful');
      post({
        type: 'result',
        data: { rawText, extractionMethod: 'text_layer', pageCount },
      });
      return;
    }

    // Step 3: Text layer insufficient — try OCR fallback
    progress('ocr', 50, 'Text layer insufficient, falling back to OCR…');
    const ocrResult = await extractOCR(buffer);

    progress('extracting', 90, 'OCR extraction complete');
    post({
      type: 'result',
      data: {
        rawText: ocrResult.text,
        extractionMethod: 'ocr',
        pageCount: ocrResult.pageCount,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error processing PDF';

    // Check for password-protected PDFs
    if (message.includes('password') || message.includes('Password')) {
      post({
        type: 'error',
        message: 'This PDF is password-protected. Please remove the password and try again.',
      });
      return;
    }

    post({
      type: 'error',
      message: `Unable to read this PDF. Please ensure it's a valid LES document. (${message})`,
    });
  }
};
