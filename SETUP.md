# Setup: Hueytown BOH Leaders

> **Status:** Steps 1–6 are done (Firebase project `hueytown-boh-leaders`). Only step 7, adding your team, is left. The steps below are kept for reference.

About 20 minutes, one time. You need a computer, your Google account, and this folder.

The site will live at **https://roudic.github.io/boh-leader-pathway/**

---

## 1. Create the Firebase project
1. Go to https://console.firebase.google.com and sign in with your Google account.
2. Click **Create a project** (or **Add project**). Name it something like `hueytown-boh-leaders`.
3. Turn **Google Analytics off** (not needed) → **Create project**.

The free **Spark** plan is all you need.

## 2. Turn on Firestore and Google sign-in
**Firestore**
1. Left menu → **Build → Firestore Database** → **Create database**.
2. Location: pick a US location (e.g. `nam5 (United States)`). You can't change this later.
3. Choose **Start in production mode** → **Create**.

**Authentication**
1. Left menu → **Build → Authentication** → **Get started**.
2. **Sign-in method** tab → **Google** → **Enable** → pick your email as the support email → **Save**.
3. **Settings** tab → **Authorized domains** → **Add domain** → type `roudic.github.io` → **Add**.
   (`localhost` is already there for testing.)

## 3. Paste the config
1. Click the ⚙️ gear (top left) → **Project settings** → **General** tab.
2. Under **Your apps**, click the **`</>`** (Web) icon. Nickname: `boh-leaders`. Leave "Firebase Hosting" **unchecked** → **Register app**.
3. You'll see a `firebaseConfig = { apiKey: ..., authDomain: ..., ... }` block.
4. Open **`src/firebase-config.js`** in this folder and replace each `PASTE_...` value with yours. Save.

These values are public identifiers, not passwords. The security rules (next step) are what protect the data.

## 4. Deploy the security rules
1. Firebase console → **Firestore Database** → **Rules** tab.
2. Delete what's there. Open **`firestore.rules`** from this folder, copy all of it, and paste it in.
3. Click **Publish**.

(Command-line alternative: `npx firebase-tools login`, then `npx firebase-tools deploy --only firestore:rules --project YOUR_PROJECT_ID`.)

## 5. Run the one-time seed
This loads `data/roster.csv`, `data/areas.csv`, `data/p5_evaluation_items.csv`, and `data/prerequisites.json` into Firestore. It also gives **your** Google email admin access.

1. Firebase console → ⚙️ **Project settings** → **Service accounts** tab → **Generate new private key** → **Generate key**. A `.json` file downloads.
2. Move it somewhere **outside** this project folder, e.g. `C:\Users\vinzi\keys\boh-service-account.json`. **Never commit or share this file.** It has full access to your database.
3. Open a terminal in this folder and run (use your own Gmail):

   ```bash
   npm install
   ```

   ```bash
   npm run seed -- --key "C:\Users\vinzi\keys\boh-service-account.json" --admin-email YOUR_GMAIL@gmail.com
   ```

4. You should see `Seeded N documents` and `members: ... → admin (Joshua Vinziant)`.
5. Once it works, you can delete the key file. Make a new one if you ever need to re-seed.

The seed refuses to run twice. Add `--force` only if you really want to overwrite the seed documents (it does not delete P5s, attendance, etc.).

## 6. Push to GitHub so Pages goes live
The repo is already created and connected. After pasting your config:

```bash
git add src/firebase-config.js
```

```bash
git commit -m "Add Firebase config"
```

```bash
git push
```

GitHub Actions builds and deploys on every push to `main`. Watch it at **https://github.com/Roudic/boh-leader-pathway/actions** (about 1–2 minutes). Then open **https://roudic.github.io/boh-leader-pathway/**.

## 7. Add your team
1. Open the site → **Sign in with Google** with the same Gmail you used in step 5.
2. **Admin → Team access** → add each person's Google email, pick who they are, and pick their role:

| Who | App role | Manager box |
|---|---|---|
| Other store managers | Manager (MOD) | ✓ |
| Shift Leaders (full and in training) | Shift Leader (MOD) | |
| Area Captains | Area Captain | |
| Assistant Captains | Assistant Captain | |
| Candidates who aren't Captains yet | Team Member (learner) | |

3. Tell them to open the link and sign in with that Google account. On a phone they can use **Share → Add to Home Screen** so it opens like an app.

## Running it on your computer (optional)
- `npm run dev` opens a local copy. Before step 3 it runs in **demo mode** (fake sign-in, data stays in your browser) so you can click around safely.
- `npm test` (on this computer only) runs the rule checks (93% vs 92.9%, 72 vs 71, 60 vs 59 days, etc.).

## What stays private
The GitHub repo is public (free Pages needs that), so these files are kept **off GitHub** by `.gitignore` and stay on this computer only: `data/roster.csv`, `data/areas.csv`, `data/pipeline_tracker.csv`, `tests/` (they use the real roster), and `private/` (spec and reference docs). Your team's real data lives only in Firestore, behind Google sign-in and the rules.
