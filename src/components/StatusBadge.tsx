import { AlertCircle, CheckCircle, Clock } from 'lucide-react';

export type FeeStatus = 'PAID' | 'UNPAID' | 'PARTIAL' | 'OVERDUE';

const STATUS_STYLES: Record<FeeStatus, { bg: string; text: string; border: string }> = {
  PAID: { bg: '#DCFCE7', text: '#14532D', border: '#4ADE80' },
  UNPAID: { bg: '#FEE2E2', text: '#7F1D1D', border: '#F87171' },
  PARTIAL: { bg: '#FEF3C7', text: '#78350F', border: '#FDE047' },
  OVERDUE: { bg: '#FEE2E2', text: '#7F1D1D', border: '#DC2626' },
};

export function StatusBadge({ status, label }: { status: FeeStatus; label?: string }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.UNPAID;
  return (
    <span
      className="px-2.5 py-0.5 rounded-full text-[11px] font-bold border inline-flex items-center gap-1.5 shadow-2xs"
      style={{ background: s.bg, color: s.text, borderColor: s.border }}
    >
      {status === 'PAID' && <CheckCircle className="h-3 w-3" />}
      {status === 'OVERDUE' && <AlertCircle className="h-3 w-3 text-red-600" />}
      {status === 'PARTIAL' && <Clock className="h-3 w-3" />}
      {status === 'UNPAID' && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
      {label || status}
    </span>
  );
}
