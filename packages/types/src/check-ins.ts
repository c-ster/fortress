export type CheckInCategory = 'emergency_fund' | 'debt' | 'tsp' | 'spending' | 'general';

export interface CheckInQuestion {
  id: string;
  category: CheckInCategory;
  text: string;
  responseType: 'yes_no' | 'scale' | 'dollar_amount';
  /** For 'scale' responses: labels for [min, max] endpoints */
  scaleLabels?: [string, string];
}

export interface CheckInResponse {
  questionId: string;
  /** yes=1/no=0 for yes_no, 1–5 for scale, dollar amount for dollar_amount */
  value: number;
  answeredAt: string; // ISO timestamp
}

export interface CheckIn {
  /** Format: `checkin_YYYY-MM-DD` */
  id: string;
  /** ISO date (YYYY-MM-DD), always the 2nd or 16th of a month */
  scheduledDate: string;
  status: 'pending' | 'completed' | 'skipped';
  responses: CheckInResponse[];
  completedAt?: string; // ISO timestamp
}

export interface TrajectoryEstimate {
  /** Key describing the metric, e.g. 'emergencyFund', 'totalDebt', 'tspBalance' */
  metric: string;
  currentValue: number;
  targetValue: number;
  /** Estimated $/month change (positive = growing, negative = shrinking) */
  monthlyRate: number;
  /** Projected date to reach target (ISO date YYYY-MM-DD), or empty if already met */
  targetDate: string;
  /** Human-readable progress message */
  message: string;
}
