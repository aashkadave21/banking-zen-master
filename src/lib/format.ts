const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });

export function formatINR(value: number | string | null | undefined): string {
  return inr.format(Number(value ?? 0));
}

/** Show only the last four digits of an account number. */
export function maskAccount(num: string): string {
  if (num.length <= 4) return num;
  return "XXXX " + num.slice(-4);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}
