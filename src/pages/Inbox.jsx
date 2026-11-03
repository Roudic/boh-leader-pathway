import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../data/AppContext.jsx';
import { store } from '../data/store.js';
import { fmtDate, nowIso } from '../lib/dates.js';
import { Card, Pill } from '../components/ui.jsx';

export default function Inbox() {
  const { id } = useParams();
  const { data, reload } = useApp();
  const name = (pid) => data.people.find((p) => p.id === pid)?.name || '—';
  const list = [...data.summaries].sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
  const open = id && list.find((s) => s.id === id);

  useEffect(() => {
    if (open && !open.readAt) store.update('summaries', open.id, { readAt: nowIso() }).then(reload);
  }, [open?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (open) {
    return (
      <>
        <p style={{ marginTop: 12 }}><Link to="/inbox">← Inbox</Link></p>
        <h1>{fmtDate(open.date)} {open.daypart} · {name(open.shiftLeaderId)}</h1>
        <Card tight>
          {[['Wins', 'wins'], ['Issues', 'issues'], ['People', 'peopleNotes'], ['Follow-ups', 'followUps']].map(([l, k]) => (
            <div key={k} style={{ marginBottom: 10 }}><b>{l}</b><div style={{ whiteSpace: 'pre-wrap' }}>{open[k] || <span className="muted">—</span>}</div></div>
          ))}
          <div className="small muted">Sent {new Date(open.submittedAt).toLocaleString()}</div>
        </Card>
      </>
    );
  }

  return (
    <>
      <h1 style={{ marginTop: 12 }}>Shift summaries</h1>
      <Card tight>
        {list.length === 0 && <p className="muted">No summaries yet.</p>}
        {list.map((s) => (
          <Link key={s.id} to={`/inbox/${s.id}`} className={`list-link ${s.readAt ? '' : 'unread'}`}>
            <span>{fmtDate(s.date)} {s.daypart} · {name(s.shiftLeaderId)}<br /><span className="muted small" style={{ fontWeight: 400 }}>{(s.issues || s.wins || '').slice(0, 70)}</span></span>
            {s.readAt ? <span className="muted small">read</span> : <Pill tone="bad">New</Pill>}
          </Link>
        ))}
      </Card>
    </>
  );
}
