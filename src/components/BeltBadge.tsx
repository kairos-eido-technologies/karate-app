import { BELT_COLORS } from '@/lib/belt-colors';

export function BeltBadge({ beltName }: { beltName?: string }) {
  if (!beltName) return <span className="text-xs text-gray-400">—</span>;
  const colors = BELT_COLORS[beltName] || { bg: '#F3F4F6', text: '#374151', border: '#D1D5DB' };
  return (
    <span
      className="px-2.5 py-0.5 rounded-full text-[11px] font-bold border inline-flex items-center gap-1 shadow-2xs"
      style={{ background: colors.bg, color: colors.text, borderColor: colors.border }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: colors.text }} />
      {beltName} Belt
    </span>
  );
}
