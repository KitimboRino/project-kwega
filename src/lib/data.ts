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

// ---- Demo accounts (the three login buttons map to these) ----
export const DEMO_USERS: Record<Role, User> = {
  member: {
    id: "u-member",
    name: "Amara Nabirye",
    role: "member",
    accountNo: "KW-00412",
    branch: "Kampala Central",
  },
  officer: { id: "u-officer", name: "James Mukasa", role: "officer", branch: "Kampala Central" },
  admin: { id: "u-admin", name: "Ruth Nalubega", role: "admin" },
};

// ---- Mock member records ----
export const MEMBERS: Member[] = [
  {
    id: "u-member",
    name: "Amara Nabirye",
    accountNo: "KW-00412",
    phone: "+256 772 448 100",
    officer: "James Mukasa",
    branch: "Kampala Central",
    status: "locked",
    principal: 1960000,
    interest: 224000,
    dailyAmount: 2000,
    startDate: "2025-08-12",
    transactions: [
      { date: "Jul 26, 2026", type: "deposit", amount: 2000, balance: 2184000 },
      { date: "Jul 25, 2026", type: "deposit", amount: 2000, balance: 2182000 },
      { date: "Jul 22, 2026", type: "interest", amount: 142000, balance: 2180000 },
      { date: "Jul 10, 2026", type: "withdrawal", amount: -60000, balance: 2038000 },
      { date: "Jul 05, 2026", type: "deposit", amount: 2000, balance: 2098000 },
    ],
  },
  {
    id: "m-455",
    name: "Sarah Aine",
    accountNo: "KW-00455",
    phone: "+256 782 334 112",
    officer: "James Mukasa",
    branch: "Kampala Central",
    status: "active",
    principal: 1100000,
    interest: 120000,
    dailyAmount: 5000,
    startDate: "2025-11-01",
    transactions: [],
  },
  {
    id: "m-459",
    name: "Peter Okello",
    accountNo: "KW-00459",
    phone: "+256 701 556 890",
    officer: "James Mukasa",
    branch: "Kampala Central",
    status: "active",
    principal: 580000,
    interest: 60000,
    dailyAmount: 2000,
    startDate: "2026-01-15",
    transactions: [],
  },
  {
    id: "m-461",
    name: "Grace Nakato",
    accountNo: "KW-00461",
    phone: "+256 772 001 234",
    officer: "James Mukasa",
    branch: "Kampala Central",
    status: "active",
    principal: 170000,
    interest: 14000,
    dailyAmount: 2000,
    startDate: "2026-05-01",
    transactions: [],
  },
  {
    id: "m-398",
    name: "David Musoke",
    accountNo: "KW-00398",
    phone: "+256 700 998 221",
    officer: "Ruth Nalubega",
    branch: "Nakawa",
    status: "locked",
    principal: 3240000,
    interest: 388000,
    dailyAmount: 10000,
    startDate: "2025-06-20",
    transactions: [],
  },
];

export const BRANCHES = [
  { name: "Kampala Central", funds: 128200000, pct: 82 },
  { name: "Nakawa", funds: 74000000, pct: 47 },
  { name: "Entebbe", funds: 61500000, pct: 39 },
  { name: "Jinja", funds: 48700000, pct: 31 },
];
