// ─────────────────────────────────────────────────────────────
// Firebase config: the ONLY file you edit to connect the app.
// Firebase console → Project settings → Your apps → Web app → "SDK setup and configuration" → Config.
// Paste the values below. (These are public identifiers, not secrets; the security rules protect the data.)
// ─────────────────────────────────────────────────────────────
export const firebaseConfig = {
  apiKey: 'PASTE_API_KEY',
  authDomain: 'PASTE_PROJECT_ID.firebaseapp.com',
  projectId: 'PASTE_PROJECT_ID',
  storageBucket: 'PASTE_PROJECT_ID.appspot.com',
  messagingSenderId: 'PASTE_SENDER_ID',
  appId: 'PASTE_APP_ID',
};

export const isConfigured = !firebaseConfig.apiKey.startsWith('PASTE');
