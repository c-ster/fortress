/**
 * PCS 3-phase timeline with informational checklists.
 * Phases: Pre-Move (90–60 days), Execution (60–0), Settlement (0–60 after).
 * Date ranges computed from the move date.
 */

interface PcsPhaseTimelineProps {
  moveDate: string; // ISO date string
}

interface Phase {
  name: string;
  range: string;
  color: string;
  bgColor: string;
  items: string[];
}

function computePhases(moveDate: string): Phase[] {
  const move = moveDate ? new Date(moveDate) : null;

  const fmtDate = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const offsetDate = (base: Date, days: number) => {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d;
  };

  const preRange = move
    ? `${fmtDate(offsetDate(move, -90))} – ${fmtDate(offsetDate(move, -60))}`
    : '90–60 days before';
  const execRange = move
    ? `${fmtDate(offsetDate(move, -60))} – ${fmtDate(move)}`
    : '60–0 days before';
  const settleRange = move
    ? `${fmtDate(move)} – ${fmtDate(offsetDate(move, 60))}`
    : '0–60 days after';

  return [
    {
      name: 'Pre-Move',
      range: preRange,
      color: 'text-fortress-navy',
      bgColor: 'bg-fortress-navy/10',
      items: [
        'Research housing and cost of living at new station',
        'Get at least 3 moving quotes (DITY) or schedule TMO pickup',
        'Set up savings allotment for out-of-pocket costs',
        'Notify landlord / start clearing quarters process',
        'Schedule household goods weight estimate',
      ],
    },
    {
      name: 'Execution',
      range: execRange,
      color: 'text-fortress-yellow',
      bgColor: 'bg-fortress-yellow/10',
      items: [
        'Complete travel voucher paperwork',
        'Arrange temporary lodging (TLE)',
        'Set up mail forwarding with USPS',
        'Coordinate utility shutoff at current station',
        'Conduct final move-out inspection',
      ],
    },
    {
      name: 'Settlement',
      range: settleRange,
      color: 'text-fortress-green',
      bgColor: 'bg-fortress-green/10',
      items: [
        'File travel claim within 5 business days',
        'Update BAH to reflect new duty station',
        'Set up new bank accounts / update direct deposit',
        'Submit DLA claim if not auto-processed',
        'Review and adjust budget for new BAH rate',
      ],
    },
  ];
}

export function PcsPhaseTimeline({ moveDate }: PcsPhaseTimelineProps) {
  const phases = computePhases(moveDate);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-fortress-navy mb-4 uppercase tracking-wider">
        PCS Timeline
      </h3>

      {/* Phase progress bar */}
      <div className="flex mb-6">
        {phases.map((phase, i) => (
          <div key={phase.name} className="flex-1 flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center
              text-xs font-bold text-white ${
              i === 0 ? 'bg-fortress-navy' : i === 1 ? 'bg-fortress-yellow' : 'bg-fortress-green'
            }`}>
              {i + 1}
            </div>
            <p className={`text-xs font-semibold mt-1 ${phase.color}`}>{phase.name}</p>
            <p className="text-[10px] text-gray-400">{phase.range}</p>
          </div>
        ))}
      </div>

      {/* Phase checklists */}
      <div className="space-y-4">
        {phases.map((phase) => (
          <div key={phase.name} className={`rounded-md p-4 ${phase.bgColor}`}>
            <h4 className={`text-sm font-semibold ${phase.color} mb-2`}>
              {phase.name}
              <span className="text-xs font-normal text-gray-400 ml-2">{phase.range}</span>
            </h4>
            <ul className="space-y-1.5">
              {phase.items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-gray-300 mt-0.5">&#9744;</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
