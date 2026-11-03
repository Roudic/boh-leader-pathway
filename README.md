# Hueytown BOH Leaders

Mobile-first app for the Chick-fil-A Hueytown Back-of-House leadership pipeline: Joshua's pipeline dashboard, P5 Evaluations, end-of-shift summaries, and person profiles. Pathways training and area checklists run in their own separate apps.

- **Live:** https://roudic.github.io/boh-leader-pathway/
- **Setup (Firebase, rules, seed, deploy):** [SETUP.md](SETUP.md)
- **For Shift Leaders:** [SHIFT_LEADER_GUIDE.md](SHIFT_LEADER_GUIDE.md)

## Stack
Vite + React, Firebase Firestore + Google sign-in, GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`).

| Path | What it is |
|---|---|
| `src/firebase-config.js` | The one file to paste your Firebase config into |
| `firestore.rules` | Role-based security rules (admin / manager / shift_leader / captain / assistant_captain / team_member) |
| `scripts/seed.mjs` | One-time seed from `data/` |
| `src/lib/rules.js` | Prerequisites, pipeline status, dashboard flags (thresholds read from settings, never hard-coded) |
| `src/lib/p5.js` | P5 scoring (80 max, pass 72, coaching flag for P average under 3) |
| `src/data/store.js` | Single data module (Firestore, or local demo mode in `npm run dev`) |

Anything the spec marks **TBD** shows as TBD in the app and is editable in **Admin → Rules & TBDs**.
