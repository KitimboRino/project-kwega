# Kwega Savings — Role-Based Savings System

One Next.js web app, three views gated by user role (RBAC).

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000

## How access control works

- **One login screen** with three demo buttons (Member / Officer / Admin).
- `AuthContext` (`src/context/AuthContext.tsx`) holds the signed-in user + role and persists it to `sessionStorage`.
- `/dashboard` is route-protected: no session → redirected back to login.
- The dashboard renders **only** the view matching the user's role. The sidebar nav is also role-specific.

## Who sees what

| Role    | Access |
|---------|--------|
| Member  | Their own account only — balance, principal (locked 1 yr), interest (withdrawable), contributions, activity |
| Officer | Opens accounts, logs daily contributions, sees only the members they manage |
| Admin   | Everyone and everything — all members, officers, branches, totals |

## System rules (`src/lib/data.ts`)

- Minimum 2,000 Ushs/day contribution
- 7% compound interest per 30-day cycle (`projectInterest`)
- Interest withdrawable anytime; principal locked for 1 year (`isLocked`, `unlockDate`)

## Structure

```
src/
  app/
    page.tsx            login (3 role buttons)
    dashboard/page.tsx  shell + role gate
    layout.tsx          wraps app in AuthProvider
    globals.css         design tokens + styles
  components/
    MemberView.tsx  OfficerView.tsx  AdminView.tsx  Icons.tsx
  context/AuthContext.tsx
  lib/data.ts           types, mock data, business rules
```

## Notes for production

Swap the mock `DEMO_USERS` / `MEMBERS` for a real auth provider (NextAuth, Clerk, or your own API) and a database. The role-gate pattern stays the same — but enforce it on the server too, not just in the UI, so a user can never fetch another role's data.
