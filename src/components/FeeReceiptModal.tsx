import { Printer, Share2, X, Shield } from 'lucide-react';
import { inr, fmtDate, fmtMonth } from '@/lib/format';
import { openWhatsApp, buildReceiptMessage } from '@/lib/whatsapp';
import { BeltBadge } from './BeltBadge';
import type { FeeRecord, Student, Settings, BeltLevel } from '@/lib/db/types';

interface FeeReceiptModalProps {
  fee: FeeRecord;
  student: Student;
  settings?: Settings | null;
  belt?: BeltLevel;
  onClose: () => void;
}

export function FeeReceiptModal({ fee, student, settings, belt, onClose }: FeeReceiptModalProps) {
  const academyName = settings?.academy_name || 'Dojo Master Academy';
  const address = settings?.address || '123 Karate Street, City 600001';
  const phone = settings?.phone || '9876543210';
  const receiptNo = fee.receipt_number || 'RCP-DRAFT';
  const paymentDate = fee.payment_date ? fmtDate(fee.payment_date) : fmtDate(new Date().toISOString());
  const monthName = fmtMonth(fee.month);

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    const msg = buildReceiptMessage({
      academyName,
      studentName: student.name,
      receiptNo,
      month: monthName,
      amount: fee.amount_paid,
      mode: fee.payment_mode || 'CASH',
      date: paymentDate,
      address,
      phone: settings?.whatsapp_number || phone,
    });
    openWhatsApp(student.parent_phone, msg);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border max-w-md w-full overflow-hidden animate-in zoom-in-95" style={{ borderColor: 'var(--border)' }}>
        {/* Actions header - hidden when printing */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-stone-50 print:hidden" style={{ borderColor: 'var(--border)' }}>
          <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Official Fee Receipt</span>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-stone-200 text-stone-500 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Printable Receipt Paper */}
        <div id="printable-receipt" className="p-6 text-stone-900 bg-white">
          {/* Header */}
          <div className="text-center pb-4 border-b border-dashed border-stone-300">
            <div className="inline-flex h-12 w-12 rounded-xl items-center justify-center mb-2" style={{ background: 'var(--primary)' }}>
              <Shield className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-wide" style={{ color: 'var(--primary)' }}>
              {academyName}
            </h2>
            <p className="text-xs text-stone-500 font-medium mt-0.5">{address}</p>
            <p className="text-xs font-mono text-stone-500">Ph: {phone}</p>
          </div>

          {/* Receipt Info */}
          <div className="py-3 border-b border-dashed border-stone-300 flex justify-between text-xs">
            <div>
              <span className="font-bold text-stone-500 block">RECEIPT NUMBER</span>
              <span className="font-mono font-black text-stone-900 text-sm">{receiptNo}</span>
            </div>
            <div className="text-right">
              <span className="font-bold text-stone-500 block">DATE</span>
              <span className="font-mono font-medium text-stone-800">{paymentDate}</span>
            </div>
          </div>

          {/* Student Info */}
          <div className="py-3 border-b border-dashed border-stone-300 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-stone-500 font-semibold">Student Name:</span>
              <span className="font-bold text-stone-900 text-sm">{student.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-stone-500 font-semibold">Rank / Belt:</span>
              <BeltBadge beltName={belt?.name} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-stone-500 font-semibold">Training Month:</span>
              <span className="font-mono font-bold text-stone-900">{monthName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-stone-500 font-semibold">Parent Contact:</span>
              <span className="font-mono text-stone-700">{student.parent_phone}</span>
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="py-3 border-b border-stone-300 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-stone-600">Monthly Tuition Fee</span>
              <span className="font-mono text-stone-800">{inr(fee.amount_due)}</span>
            </div>
            <div className="flex justify-between font-bold text-stone-900 pt-2 border-t border-stone-200 text-sm">
              <span>TOTAL PAID</span>
              <span className="font-mono font-black" style={{ color: 'var(--primary)' }}>
                {inr(fee.amount_paid)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-stone-600 pt-1">
              <span>Payment Mode</span>
              <span className="font-bold uppercase tracking-wider">{fee.payment_mode || 'CASH'}</span>
            </div>
            {Number(fee.balance_due ?? (fee.amount_due - fee.amount_paid)) > 0 && (
              <div className="flex justify-between text-xs text-amber-700 font-semibold pt-1">
                <span>Remaining Balance</span>
                <span className="font-mono">{inr(fee.balance_due ?? (fee.amount_due - fee.amount_paid))}</span>
              </div>
            )}
          </div>

          {/* Footer message */}
          <div className="text-center pt-4">
            <p className="text-xs font-semibold text-stone-700">Thank you! Keep training hard! 🥋</p>
            <p className="text-[10px] text-stone-400 mt-1">This is a computer generated receipt.</p>
          </div>
        </div>

        {/* Modal Buttons - hidden during print */}
        <div className="p-4 bg-stone-50 border-t flex gap-2 print:hidden" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={handlePrint}
            className="flex-1 h-10 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold cursor-pointer transition active:scale-95 hover:bg-stone-200"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            <Printer className="h-4 w-4" />
            Print Receipt
          </button>
          <button
            onClick={handleShareWhatsApp}
            className="flex-1 h-10 rounded-xl text-white flex items-center justify-center gap-2 text-xs font-bold cursor-pointer transition active:scale-95 shadow-xs"
            style={{ background: '#25D366' }}
          >
            <Share2 className="h-4 w-4" />
            WhatsApp
          </button>
          <button
            onClick={onClose}
            className="h-10 px-4 rounded-xl border text-xs font-semibold cursor-pointer transition active:scale-95 hover:bg-stone-200"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
