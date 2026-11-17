export function openWhatsApp(phone: string, message: string) {
  const cleaned = phone.replace(/\D/g, "");
  const url = `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
}

export function buildReminderMessage(opts: {
  academyName: string;
  parentName: string;
  studentName: string;
  amount: number;
  month: string;
  phone: string;
}): string {
  return `Dear ${opts.parentName || opts.studentName},\nThis is a friendly reminder from ${opts.academyName}.\nYour monthly training fee of \u20B9${opts.amount} for ${opts.month} is pending.\nPlease pay at the earliest to avoid any interruption in training.\nAcademy Contact: ${opts.phone}\nThank you,\n${opts.academyName}`;
}

export function buildReceiptMessage(opts: {
  academyName: string;
  studentName: string;
  receiptNo: string;
  month: string;
  amount: number;
  mode: string;
  date: string;
  address: string;
  phone: string;
}): string {
  return `\u2705 Fee Receipt \u2014 ${opts.academyName}\nReceipt No: ${opts.receiptNo}\nStudent: ${opts.studentName}\nMonth: ${opts.month}\nAmount Paid: \u20B9${opts.amount}\nPayment Mode: ${opts.mode}\nPayment Date: ${opts.date}\nThank you for timely payment! \uD83E\uDD4B\n${opts.academyName}\n${opts.phone} | ${opts.address}`;
}
