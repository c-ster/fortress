/**
 * Payday check-in card: renders 2 questions with appropriate response inputs,
 * collects answers, and submits or skips.
 */

import { useState } from 'react';
import type { CheckIn, CheckInQuestion, CheckInResponse } from '@fortress/types';
import { NumberInput } from '../shared/NumberInput';

interface CheckInCardProps {
  checkIn: CheckIn;
  questions: CheckInQuestion[];
  onComplete: (checkIn: CheckIn) => void;
  onSkip: (checkIn: CheckIn) => void;
}

function formatScheduledDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// --- Response Inputs ---

function YesNoInput({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-2 mt-2">
      <button
        type="button"
        onClick={() => onChange(1)}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          value === 1
            ? 'bg-fortress-green text-white'
            : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
        }`}
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => onChange(0)}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          value === 0
            ? 'bg-fortress-red text-white'
            : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
        }`}
      >
        No
      </button>
    </div>
  );
}

function ScaleInput({
  value,
  onChange,
  labels,
}: {
  value: number | null;
  onChange: (v: number) => void;
  labels?: [string, string];
}) {
  return (
    <div className="mt-2">
      <div className="flex gap-2 items-center">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-10 h-10 rounded-full text-sm font-semibold transition-colors ${
              value === n
                ? 'bg-fortress-navy text-white'
                : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      {labels && (
        <div className="flex justify-between mt-1 px-1">
          <span className="text-xs text-gray-400">{labels[0]}</span>
          <span className="text-xs text-gray-400">{labels[1]}</span>
        </div>
      )}
    </div>
  );
}

function DollarInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mt-2 max-w-[200px]">
      <NumberInput
        label=""
        value={value}
        onChange={onChange}
        prefix="$"
        min={0}
        max={10000}
        step={10}
        placeholder="0"
      />
    </div>
  );
}

// --- Main Component ---

export function CheckInCard({ checkIn, questions, onComplete, onSkip }: CheckInCardProps) {
  // Track response values: questionId → value (null = unanswered)
  const [responses, setResponses] = useState<Record<string, number | null>>(() => {
    const init: Record<string, number | null> = {};
    for (const q of questions) {
      init[q.id] = q.responseType === 'dollar_amount' ? 0 : null;
    }
    return init;
  });

  const allAnswered = questions.every((q) => responses[q.id] != null);

  const handleResponse = (questionId: string, value: number) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = () => {
    const now = new Date().toISOString();
    const checkInResponses: CheckInResponse[] = questions
      .filter((q) => responses[q.id] != null)
      .map((q) => ({
        questionId: q.id,
        value: responses[q.id]!,
        answeredAt: now,
      }));

    onComplete({
      ...checkIn,
      status: 'completed',
      responses: checkInResponses,
      completedAt: now,
    });
  };

  const handleSkip = () => {
    onSkip({
      ...checkIn,
      status: 'skipped',
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-fortress-navy/20 p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-fortress-navy text-lg">&#128221;</span>
        <div>
          <h4 className="text-base font-semibold text-fortress-navy">
            Payday Check-In
          </h4>
          <p className="text-xs text-gray-400">
            {formatScheduledDate(checkIn.scheduledDate)}
          </p>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-5">
        {questions.map((question) => (
          <div key={question.id}>
            <p className="text-sm font-medium text-fortress-slate">
              {question.text}
            </p>

            {question.responseType === 'yes_no' && (
              <YesNoInput
                value={responses[question.id]}
                onChange={(v) => handleResponse(question.id, v)}
              />
            )}

            {question.responseType === 'scale' && (
              <ScaleInput
                value={responses[question.id]}
                onChange={(v) => handleResponse(question.id, v)}
                labels={question.scaleLabels}
              />
            )}

            {question.responseType === 'dollar_amount' && (
              <DollarInput
                value={responses[question.id] ?? 0}
                onChange={(v) => handleResponse(question.id, v)}
              />
            )}
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="mt-5 flex gap-3 border-t border-gray-100 pt-4">
        <button
          onClick={handleSubmit}
          disabled={!allAnswered}
          className="bg-fortress-navy text-white px-5 py-2 rounded-md text-sm font-medium
            hover:bg-fortress-navy/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Submit Check-In
        </button>
        <button
          onClick={handleSkip}
          className="border border-gray-300 text-gray-600 px-5 py-2 rounded-md text-sm
            font-medium hover:bg-gray-50 transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
