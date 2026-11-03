import { useEffect, useState } from 'react';
import { store, demoMode } from '../data/store.js';
import { useApp } from '../data/AppContext.jsx';

export default function SignIn({ notMember, error }) {
  const { authUser } = useApp();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [demoPeople, setDemoPeople] = useState([]);

  useEffect(() => {
    if (!demoMode) return;
    Promise.all([store.list('members'), store.list('people')]).then(([m, p]) =>
      setDemoPeople(m.map((x) => ({ ...x, name: p.find((pp) => pp.id === x.personId)?.name })).sort((a, b) => a.personId.localeCompare(b.personId))));
  }, []);

  const go = async () => {
    setBusy(true); setErr('');
    try { await store.signIn(); } catch (e) { if (!/popup-closed|cancelled/.test(e.code || '')) setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="center-screen">
      <div className="logo">BOH</div>
      <h1>Hueytown BOH Leaders</h1>
      {notMember ? (
        <>
          <p><b>{authUser?.email}</b> isn't on the team list yet.</p>
          <p className="muted">Ask Joshua to add this Google email in Admin → Team access, then sign in again.</p>
          <button className="btn secondary" onClick={() => store.signOut()}>Use a different account</button>
        </>
      ) : demoMode ? (
        <>
          <p className="muted">Demo: pick who to sign in as.</p>
          <div className="stack">
            {demoPeople.map((m) => (
              <button key={m.email} className="btn secondary" onClick={() => store.signIn(m.email)}>
                {m.name} <span className="muted small">({m.role.replace('_', ' ')})</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="muted">Sign in with the Google account Joshua added for you.</p>
          <button className="btn" onClick={go} disabled={busy}>{busy ? 'Opening Google…' : 'Sign in with Google'}</button>
        </>
      )}
      {(err || error) && <p className="field-error">{err || error}</p>}
    </div>
  );
}
