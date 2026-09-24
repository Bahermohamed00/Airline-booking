export function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function daysFromNow(days: number): string {
  return toDateInput(new Date(Date.now() + days * 86400000));
}
