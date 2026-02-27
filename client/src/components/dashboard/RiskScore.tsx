interface RiskScoreProps {
  score: number;
  tier: 'green' | 'yellow' | 'red';
}

const RADIUS = 45;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const tierConfig = {
  green: { stroke: '#22c55e', color: 'text-fortress-green', bg: 'bg-fortress-green', label: 'Ready' },
  yellow: { stroke: '#eab308', color: 'text-fortress-yellow', bg: 'bg-fortress-yellow', label: 'Caution' },
  red: { stroke: '#ef4444', color: 'text-fortress-red', bg: 'bg-fortress-red', label: 'At Risk' },
} as const;

export function RiskScore({ score, tier }: RiskScoreProps) {
  const config = tierConfig[tier];
  const offset = CIRCUMFERENCE * (1 - score / 100);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
      <div className="relative w-40 h-40 mx-auto">
        <svg className="w-full h-full" viewBox="0 0 100 100">
          {/* Background track */}
          <circle
            cx="50" cy="50" r={RADIUS}
            fill="none" stroke="#e5e7eb" strokeWidth="8"
          />
          {/* Score arc */}
          <circle
            cx="50" cy="50" r={RADIUS}
            fill="none" stroke={config.stroke} strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            transform="rotate(-90 50 50)"
            className="transition-all duration-700"
          />
        </svg>

        {/* Score number centered over SVG */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className={`text-5xl font-bold ${config.color}`}>{score}</p>
          <p className="text-sm text-gray-400">/ 100</p>
        </div>
      </div>

      <div className="mt-4">
        <span
          className={`inline-block px-3 py-1 rounded-full text-sm font-semibold text-white ${config.bg}`}
        >
          {config.label}
        </span>
      </div>
    </div>
  );
}
