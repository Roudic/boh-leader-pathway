// The one data module. Everything in the app reads/writes through `store`.
// Backend: Firebase (Firestore + Google sign-in), or a local demo copy for previewing
// (only when running `npm run dev` before Firebase is configured, or with ?demo in dev).
import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where,
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { firebaseConfig, isConfigured } from '../firebase-config.js';
import { nowIso } from '../lib/dates.js';

export const demoMode = import.meta.env.DEV && (!isConfigured || new URLSearchParams(location.search).has('demo'));

let actor = 'unknown';
export function setActor(a) { actor = a || 'unknown'; }
const stamp = (data, isNew) => ({ ...data, updatedAt: nowIso(), ...(isNew ? { createdAt: nowIso(), createdBy: actor } : {}) });

// ---------------- Firebase backend ----------------
function firebaseBackend() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);
  const withId = (d) => ({ id: d.id, ...d.data() });
  return {
    async list(col, wheres = []) {
      const q = wheres.length ? query(collection(db, col), ...wheres.map(([f, op, v]) => where(f, op, v))) : collection(db, col);
      return (await getDocs(q)).docs.map(withId);
    },
    async get(col, id) {
      const d = await getDoc(doc(db, col, id));
      return d.exists() ? withId(d) : null;
    },
    set: (col, id, data, merge = false) => setDoc(doc(db, col, id), stamp(data, !merge), { merge }),
    async add(col, data) { return (await addDoc(collection(db, col), stamp(data, true))).id; },
    update: (col, id, patch) => updateDoc(doc(db, col, id), stamp(patch, false)),
    remove: (col, id) => deleteDoc(doc(db, col, id)),
    onAuth: (cb) => onAuthStateChanged(auth, (u) => cb(u ? { email: u.email?.toLowerCase(), name: u.displayName } : null)),
    signIn: () => signInWithPopup(auth, new GoogleAuthProvider()),
    signOut: () => signOut(auth),
  };
}

// ---------------- Demo backend (localStorage) ----------------
function demoBackend() {
  const KEY = 'boh-demo-db-v1';
  let data = null;
  const load = async () => {
    if (data) return data;
    try { data = JSON.parse(localStorage.getItem(KEY)); } catch { data = null; }
    if (!data) {
      const { buildDemoSeed } = await import('./demoSeed.js');
      data = await buildDemoSeed();
      save();
    }
    return data;
  };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ } };
  const match = (row, [f, op, v]) => (op === '==' ? row[f] === v : op === '>=' ? row[f] >= v : op === '<=' ? row[f] <= v : true);
  let authCb = null;
  let user = null;
  try { user = JSON.parse(sessionStorage.getItem('boh-demo-user')); } catch { /* ignore */ }
  return {
    async list(col, wheres = []) {
      const d = await load();
      return Object.entries(d[col] || {}).map(([id, v]) => ({ id, ...v })).filter((r) => wheres.every((w) => match(r, w)));
    },
    async get(col, id) { const d = await load(); const v = d[col]?.[id]; return v ? { id, ...v } : null; },
    async set(col, id, v, merge = false) { const d = await load(); d[col] ||= {}; d[col][id] = stamp(merge ? { ...d[col][id], ...v } : v, !merge || !d[col][id]); save(); },
    async add(col, v) { const id = Math.random().toString(36).slice(2, 12); await this.set(col, id, v); return id; },
    async update(col, id, patch) { const d = await load(); d[col][id] = stamp({ ...d[col][id], ...patch }, false); save(); },
    async remove(col, id) { const d = await load(); delete d[col]?.[id]; save(); },
    onAuth(cb) { authCb = cb; setTimeout(() => cb(user), 0); return () => { authCb = null; }; },
    async signIn(email) { user = { email, name: email }; sessionStorage.setItem('boh-demo-user', JSON.stringify(user)); authCb?.(user); },
    async signOut() { user = null; sessionStorage.removeItem('boh-demo-user'); authCb?.(null); },
    reset() { localStorage.removeItem(KEY); sessionStorage.removeItem('boh-demo-user'); location.reload(); },
  };
}

export const store = demoMode ? demoBackend() : isConfigured ? firebaseBackend() : null;
