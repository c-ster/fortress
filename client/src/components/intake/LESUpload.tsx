import { useRef, useState, useCallback } from 'react';
import { parseLES } from '../../engine/les-parser';
import type { LESParseResult, LESProgress } from '@fortress/types';

interface LESUploadProps {
  onResult: (result: LESParseResult) => void;
  onCancel: () => void;
  onError: (message: string) => void;
}

export function LESUpload({ onResult, onCancel, onError }: LESUploadProps) {
  const [progress, setProgress] = useState<LESProgress | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      try {
        setProgress({ stage: 'loading', percent: 0, message: 'Starting…' });
        const result = await parseLES(file, setProgress);
        onResult(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to process PDF';
        setProgress(null);
        onError(message);
      }
    },
    [onResult, onError],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragActive(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleClick = () => inputRef.current?.click();

  // --- Processing state ---
  if (progress) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <div className="mb-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full
            bg-fortress-navy/10 mb-3">
            <svg className="w-6 h-6 text-fortress-navy animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor"
                strokeWidth="4" />
              <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-fortress-navy capitalize">
            {progress.stage === 'ocr' ? 'Running OCR' : progress.stage}…
          </p>
          <p className="text-xs text-gray-500 mt-1">{progress.message}</p>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-xs mx-auto bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-fortress-navy rounded-full transition-all duration-300"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2">{progress.percent}%</p>

        <button
          onClick={onCancel}
          className="mt-4 text-sm text-gray-500 hover:text-fortress-navy underline"
        >
          Cancel
        </button>
      </div>
    );
  }

  // --- Idle (drop zone) ---
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
          transition-colors
          ${dragActive
            ? 'border-fortress-navy bg-fortress-navy/5'
            : 'border-gray-300 hover:border-fortress-navy/50 hover:bg-gray-50'}`}
      >
        {/* Upload icon */}
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full
          bg-fortress-navy/10 mb-4">
          <svg className="w-7 h-7 text-fortress-navy" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5
              7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625
              c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621
              0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>

        <p className="text-sm font-semibold text-fortress-navy mb-1">
          Drag your LES PDF here
        </p>
        <p className="text-xs text-gray-500">
          or click to select a file
        </p>
        <p className="text-xs text-gray-400 mt-3">
          PDF only &middot; Max 20 MB &middot; Your PDF stays on this device
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleInputChange}
        className="hidden"
        aria-label="Select LES PDF file"
      />

      <div className="mt-4 flex justify-between items-center">
        <button
          onClick={onCancel}
          className="text-sm text-gray-500 hover:text-fortress-navy"
        >
          &larr; Back to manual entry
        </button>
        <p className="text-xs text-gray-400">
          Your LES never leaves your browser
        </p>
      </div>
    </div>
  );
}
