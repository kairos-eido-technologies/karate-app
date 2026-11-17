import { format } from "date-fns";

export const inr = (n?: number) =>
  `\u20B9${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

export const fmtDate = (d: string) => {
  try { return format(new Date(d), "dd MMM yyyy"); } catch { return d; }
};

export const fmtMonth = (m: string) => {
  try { return format(new Date(m + "-01"), "MMMM yyyy"); } catch { return m; }
};

export const genReceiptNo = (seq: number) =>
  `RCP-${new Date().getFullYear()}-${String(seq).padStart(4, "0")}`;
