import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseLES } from '../../src/engine/les-parser';

// --- Mock Web Worker ---

let workerInstance: MockWorker | null = null;

class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    workerInstance = this;
  }

  postMessage() {
    // no-op — tests will manually call _emit
  }

  terminate() {
    // no-op
  }

  /** Simulate sending a message from the worker */
  _emit(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}

// Replace globalThis.Worker
vi.stubGlobal('Worker', MockWorker);

// --- Helpers ---

const SAMPLE_LES_TEXT = `
LEAVE AND EARNINGS STATEMENT
BASE PAY $3,466.50
BAH $1,872.00
BAS $406.98
FEDERAL TAX $312.00
STATE TAX $142.50
FICA $265.20
SGLI $31.00
TSP $346.65
ALLOTMENT SAVINGS $500.00
`;

function makePdfFile(name = 'test.pdf', sizeBytes = 1024): File {
  const data = new Uint8Array(sizeBytes);
  const file = new File([data], name, { type: 'application/pdf' });

  // jsdom File may not have arrayBuffer — polyfill if needed
  if (typeof file.arrayBuffer !== 'function') {
    file.arrayBuffer = () => Promise.resolve(data.buffer as ArrayBuffer);
  }

  return file;
}

// --- Tests ---

describe('parseLES', () => {
  beforeEach(() => {
    workerInstance = null;
  });

  it('returns LESParseResult with correct shape', async () => {
    const file = makePdfFile();
    const parsePromise = parseLES(file);

    // Tick event loop so parseLES reaches worker creation
    await vi.waitFor(() => expect(workerInstance).not.toBeNull(), { timeout: 200 });

    workerInstance!._emit({
      type: 'result',
      data: { rawText: SAMPLE_LES_TEXT, extractionMethod: 'text_layer', pageCount: 1 },
    });

    const result = await parsePromise;

    expect(result).toHaveProperty('fields');
    expect(result).toHaveProperty('rawText');
    expect(result).toHaveProperty('extractionMethod');
    expect(result).toHaveProperty('pageCount');
    expect(result.extractionMethod).toBe('text_layer');
    expect(result.pageCount).toBe(1);
    expect(result.fields.length).toBeGreaterThanOrEqual(8);
  });

  it('fires onProgress callback at least twice', async () => {
    const file = makePdfFile();
    const progressCalls: unknown[] = [];
    const parsePromise = parseLES(file, (p) => progressCalls.push(p));

    await vi.waitFor(() => expect(workerInstance).not.toBeNull(), { timeout: 200 });

    workerInstance!._emit({
      type: 'progress',
      data: { stage: 'loading', percent: 20, message: 'Loading…' },
    });
    workerInstance!._emit({
      type: 'progress',
      data: { stage: 'rendering', percent: 60, message: 'Rendering…' },
    });
    workerInstance!._emit({
      type: 'result',
      data: { rawText: SAMPLE_LES_TEXT, extractionMethod: 'text_layer', pageCount: 1 },
    });

    await parsePromise;

    // parseLES fires 'loading' at start + 2 from worker + 'extracting' + 'done' = ≥4
    expect(progressCalls.length).toBeGreaterThanOrEqual(4);
  });

  it('rejects for non-PDF file', async () => {
    const file = new File(['hello'], 'report.txt', { type: 'text/plain' });
    await expect(parseLES(file)).rejects.toThrow('Only PDF files are supported');
  });

  it('rejects for empty file', async () => {
    const file = makePdfFile('empty.pdf', 0);
    // Override size to report 0
    Object.defineProperty(file, 'size', { value: 0 });
    await expect(parseLES(file)).rejects.toThrow('File is empty');
  });

  it('rejects for oversized file', async () => {
    const file = makePdfFile('huge.pdf', 1024);
    Object.defineProperty(file, 'size', { value: 30 * 1024 * 1024 });
    await expect(parseLES(file)).rejects.toThrow('too large');
  });

  it('rejects when worker posts error', async () => {
    const file = makePdfFile();
    const parsePromise = parseLES(file);

    await vi.waitFor(() => expect(workerInstance).not.toBeNull(), { timeout: 200 });
    workerInstance!._emit({ type: 'error', message: 'Corrupted PDF' });

    await expect(parsePromise).rejects.toThrow('Corrupted PDF');
  });

  it('extracts fields from worker result text with OCR method', async () => {
    const file = makePdfFile();
    const parsePromise = parseLES(file);

    await vi.waitFor(() => expect(workerInstance).not.toBeNull(), { timeout: 200 });
    workerInstance!._emit({
      type: 'result',
      data: { rawText: SAMPLE_LES_TEXT, extractionMethod: 'ocr', pageCount: 2 },
    });

    const result = await parsePromise;

    expect(result.extractionMethod).toBe('ocr');
    expect(result.pageCount).toBe(2);

    const basePay = result.fields.find((f) => f.field === 'basePay');
    expect(basePay).toBeDefined();
    expect(basePay!.value).toBe(3466.50);
    expect(basePay!.source).toBe('ocr');
  });
});
