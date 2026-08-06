// ---- Domain types ----
export type Role = "member" | "officer" | "admin";

export interface User {
  id: string;
  name: string;
  role: Role;
  accountNo?: string; // members only
  branch?: string;
}

export interface Transaction {
  date: string;
  type: "deposit" | "interest" | "withdrawal";
  amount: number;
  balance: number;
}

export interface Member {
  id: string;
  name: string;
  accountNo: string;
  phone: string;
  officer: string;
  branch: string;
  status: "active" | "locked";
  principal: number;
  interest: number;
  dailyAmount: number;
  startDate: string; // ISO — used for the 1-year lock
  transactions: Transaction[];
}

// ---- System rules (from the brief) ----
export const RULES = {
  MIN_DAILY: 2000, // Ushs minimum per day
  MONTHLY_RATE: 0.07, // 7% compound after 30 days
  LOCK_MONTHS: 12, // principal locked for min 1 year
};

// Compound the principal by 7% for each full 30-day cycle elapsed.
export function projectInterest(principal: number, startDateISO: string, asOf = new Date()) {
  const start = new Date(startDateISO);
  const days = Math.floor((asOf.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const cycles = Math.floor(days / 30);
  const grown = principal * Math.pow(1 + RULES.MONTHLY_RATE, cycles);
  return Math.round(grown - principal);
}

// Principal unlocks 1 year after start date.
export function unlockDate(startDateISO: string) {
  const d = new Date(startDateISO);
  d.setMonth(d.getMonth() + RULES.LOCK_MONTHS);
  return d;
}

export function isLocked(startDateISO: string, asOf = new Date()) {
  return asOf < unlockDate(startDateISO);
}

export const fmt = (n: number) => n.toLocaleString("en-UG");
