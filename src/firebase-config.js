// ─────────────────────────────────────────────────────────────
// Firebase config: the ONLY file you edit to connect the app.
// Firebase console → Project settings → Your apps → Web app → "SDK setup and configuration" → Config.
// (These are public identifiers, not secrets; the security rules protect the data.)
// ─────────────────────────────────────────────────────────────
export const firebaseConfig = {
  apiKey: 'AIzaSyBurNqhoj4QhC045ZWyNPYowFEmKDW1LYU',
  authDomain: 'hueytown-boh-leaders.firebaseapp.com',
  projectId: 'hueytown-boh-leaders',
  storageBucket: 'hueytown-boh-leaders.firebasestorage.app',
  messagingSenderId: '773572962126',
  appId: '1:773572962126:web:ef22c69eaacec60ceee01f',
};

export const isConfigured = !firebaseConfig.apiKey.startsWith('PASTE');
