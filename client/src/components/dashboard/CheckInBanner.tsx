/**
 * Notification banner shown at top of dashboard when a payday check-in is due.
 * Appears on 2nd and 16th of each month (day after military paydays).
 */

interface CheckInBannerProps {
  onScrollToCheckIn: () => void;
}

export function CheckInBanner({ onScrollToCheckIn }: CheckInBannerProps) {
  return (
    <div
      className="bg-fortress-navy/5 border border-fortress-navy/20 rounded-lg p-4 mb-6
        flex items-center justify-between gap-4"
    >
      <div className="flex items-center gap-3">
        <span className="text-fortress-navy text-xl">&#128221;</span>
        <div>
          <p className="text-sm font-semibold text-fortress-navy">
            Payday Check-In Available
          </p>
          <p className="text-sm text-gray-600 mt-0.5">
            Take 2 minutes to track your financial progress since last payday.
          </p>
        </div>
      </div>
      <button
        onClick={onScrollToCheckIn}
        className="shrink-0 bg-fortress-navy text-white px-4 py-2 rounded-md
          text-sm font-medium hover:bg-fortress-navy/90 transition-colors"
      >
        Complete Now &rarr;
      </button>
    </div>
  );
}
