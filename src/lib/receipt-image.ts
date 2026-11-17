import { inr, fmtDate, fmtMonth } from './format';
import type { FeeRecord, Student, Settings, BeltLevel } from './db/types';

export interface ReceiptImageParams {
  fee: FeeRecord;
  student: Student;
  settings?: Settings | null;
  belt?: BeltLevel;
}

export async function generateReceiptImageBlob(params: ReceiptImageParams): Promise<{ blob: Blob; dataUrl: string; filename: string }> {
  const { fee, student, settings, belt } = params;

  const academyName = (settings?.academy_name || 'Dojo Master Academy').toUpperCase();
  const address = settings?.address || 'Karate Training Center';
  const phone = settings?.phone || settings?.whatsapp_number || '';
  const receiptNo = fee.receipt_number || `RCP-${fee.month.replace('-', '')}-${fee.id.slice(0, 4).toUpperCase()}`;
  const paymentDate = fee.payment_date ? fmtDate(fee.payment_date) : fmtDate(new Date().toISOString());
  const monthName = fmtMonth(fee.month);
  const amountPaid = fee.amount_paid || 0;
  const amountDue = fee.amount_due || student.monthly_fee || 1500;
  const balanceDue = Math.max(0, amountDue - amountPaid);
  const isPaid = amountPaid >= amountDue;
  const paymentMode = (fee.payment_mode || 'CASH').toUpperCase();
  const beltName = belt?.name ? `${belt.name} Belt` : 'Karate Student';

  // Canvas setup (high resolution 750 x 1020)
  const width = 750;
  const height = 1020;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Outer border
  ctx.strokeStyle = '#E5E7EB';
  ctx.lineWidth = 4;
  ctx.strokeRect(12, 12, width - 24, height - 24);

  // Top Header Banner (Karate Deep Red)
  ctx.fillStyle = '#8B1A1A';
  ctx.fillRect(14, 14, width - 28, 145);

  // Header Gold Stripe
  ctx.fillStyle = '#D4AF37';
  ctx.fillRect(14, 159, width - 28, 6);

  // Karate Shield Icon
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  const iconX = 50;
  const iconY = 45;
  ctx.roundRect(iconX, iconY, 54, 54, 12);
  ctx.fill();

  // Shield Emblem
  ctx.fillStyle = '#8B1A1A';
  ctx.beginPath();
  ctx.arc(iconX + 27, iconY + 27, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🥋', iconX + 27, iconY + 28);
  ctx.restore();

  // Academy Name
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(academyName, 120, 68);

  // Academy Details
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = '500 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(address, 120, 92);
  if (phone) {
    ctx.fillText(`Phone: ${phone}`, 120, 112);
  }

  // Watermark (Martial Arts Enso ring)
  ctx.save();
  ctx.strokeStyle = 'rgba(139, 26, 26, 0.04)';
  ctx.lineWidth = 20;
  ctx.beginPath();
  ctx.arc(width / 2, height / 2 + 50, 160, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Title: Official Fee Receipt
  ctx.fillStyle = '#1C1917';
  ctx.font = '800 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('OFFICIAL TUITION FEE RECEIPT', 40, 205);

  ctx.fillStyle = '#78716C';
  ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Issued for training session tuition fees', 40, 226);

  // Receipt Number & Date Box (Top Right)
  ctx.textAlign = 'right';
  ctx.fillStyle = '#8B1A1A';
  ctx.font = '900 16px "JetBrains Mono", monospace, sans-serif';
  ctx.fillText(receiptNo, width - 40, 205);

  ctx.fillStyle = '#78716C';
  ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`Date: ${paymentDate}`, width - 40, 226);

  // Divider
  ctx.strokeStyle = '#E7E5E4';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 245);
  ctx.lineTo(width - 40, 245);
  ctx.stroke();

  // Student Details Box
  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.roundRect(40, 265, width - 80, 150, 14);
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Student Info Content
  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748B';
  ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('STUDENT NAME', 65, 298);
  ctx.fillText('BELT RANK', 420, 298);

  ctx.fillStyle = '#0F172A';
  ctx.font = '800 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(student.name, 65, 324);

  // Belt Rank with Badge color
  const beltColor = belt?.color_hex || '#FBBF24';
  ctx.fillStyle = beltColor;
  ctx.beginPath();
  ctx.roundRect(420, 308, 14, 18, 4);
  ctx.fill();
  ctx.strokeStyle = '#CBD5E1';
  ctx.stroke();

  ctx.fillStyle = '#0F172A';
  ctx.font = '700 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(beltName, 442, 323);

  // Row 2: Training Month & Parent WhatsApp
  ctx.fillStyle = '#64748B';
  ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('TRAINING MONTH', 65, 368);
  ctx.fillText('PARENT CONTACT', 420, 368);

  ctx.fillStyle = '#0F172A';
  ctx.font = '700 15px "JetBrains Mono", monospace, sans-serif';
  ctx.fillText(monthName, 65, 393);
  ctx.fillText(student.parent_phone || '—', 420, 393);

  // Breakdown Card
  const tableTop = 445;
  ctx.fillStyle = '#1E293B';
  ctx.font = '800 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('PAYMENT DETAILS', 40, tableTop);

  // Details box
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(40, tableTop + 14, width - 80, 160, 12);
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.stroke();

  const drawRow = (label: string, val: string, y: number, isBold = false) => {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#475569';
    ctx.font = `${isBold ? '700' : '500'} 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText(label, 65, y);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#0F172A';
    ctx.font = `${isBold ? '800' : '600'} 14px "JetBrains Mono", monospace, sans-serif`;
    ctx.fillText(val, width - 65, y);
  };

  drawRow('Standard Monthly Tuition', inr(amountDue), tableTop + 50);
  drawRow('Payment Mode', paymentMode, tableTop + 85);
  drawRow('Transaction Date', paymentDate, tableTop + 120);
  if (balanceDue > 0) {
    drawRow('Remaining Outstanding Balance', inr(balanceDue), tableTop + 155, true);
  }

  // Large Highlight Card: Amount Paid & Status
  const highlightTop = 645;
  ctx.fillStyle = isPaid ? '#F0FDF4' : '#FEFCE8';
  ctx.beginPath();
  ctx.roundRect(40, highlightTop, width - 80, 165, 16);
  ctx.fill();
  ctx.strokeStyle = isPaid ? '#86EFAC' : '#FDE047';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Status Badge
  const badgeX = width - 180;
  const badgeY = highlightTop + 24;
  ctx.fillStyle = isPaid ? '#16A34A' : '#CA8A04';
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, 120, 32, 16);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(isPaid ? '✓ PAID IN FULL' : 'PARTIAL PAID', badgeX + 60, badgeY + 20);

  // Amount Paid Label & Value
  ctx.textAlign = 'left';
  ctx.fillStyle = isPaid ? '#166534' : '#854D0E';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('TOTAL AMOUNT PAID', 65, highlightTop + 45);

  ctx.fillStyle = isPaid ? '#15803D' : '#A16207';
  ctx.font = '900 46px "JetBrains Mono", monospace, sans-serif';
  ctx.fillText(inr(amountPaid), 65, highlightTop + 110);

  ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#64748B';
  ctx.fillText(isPaid ? 'Payment verified and credited successfully' : `Balance of ${inr(balanceDue)} remaining for this month`, 65, highlightTop + 142);

  // Footer Message Box
  const footerTop = 845;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#334155';
  ctx.font = '600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Thank you for training with us! Keep up the dedication! 🥋', width / 2, footerTop);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('This is an official computer-generated receipt issued by Dojo Manager.', width / 2, footerTop + 24);
  ctx.fillText(`Receipt ID: ${receiptNo} • Generated on ${new Date().toLocaleString('en-IN')}`, width / 2, footerTop + 42);

  // Convert canvas to blob & dataUrl
  const dataUrl = canvas.toDataURL('image/png');
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas blob conversion failed'))), 'image/png');
  });

  const filename = `Receipt_${student.name.replace(/\s+/g, '_')}_${receiptNo}.png`;

  return { blob, dataUrl, filename };
}

// Share receipt image directly to WhatsApp (Android native bridge + Web Share API + Clipboard fallback)
export async function shareReceiptToWhatsApp(params: ReceiptImageParams): Promise<void> {
  const { blob, dataUrl, filename } = await generateReceiptImageBlob(params);
  const studentName = params.student.name;
  const parentPhone = params.student.parent_phone || '';
  const receiptNo = params.fee.receipt_number || 'RCP';
  const caption = `Official Fee Receipt for ${studentName} (${receiptNo}) - ${params.settings?.academy_name || 'Dojo Master Academy'}`;

  // 1. Android Native Bridge (Android APK)
  if ((window as any).AndroidBridge?.shareReceiptImage) {
    (window as any).AndroidBridge.shareReceiptImage(dataUrl, filename, parentPhone, caption);
    return;
  }

  // 2. Web Share API with Files (Chrome on Mobile & modern browsers)
  try {
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: `Receipt ${receiptNo}`,
        text: caption,
      });
      return;
    }
  } catch (err: any) {
    if (err.name === 'AbortError') return; // User cancelled share sheet
  }

  // 3. Desktop browser fallback: Copy image to clipboard & download image & open WhatsApp Web
  try {
    if (navigator.clipboard && (window as any).ClipboardItem) {
      await navigator.clipboard.write([
        new (window as any).ClipboardItem({ 'image/png': blob }),
      ]);
    }
  } catch {}

  // Trigger download so user has the file
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Open WhatsApp chat
  const cleanPhone = parentPhone.replace(/\D/g, '');
  const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : 'https://web.whatsapp.com/';
  window.open(waUrl, '_blank');
}
