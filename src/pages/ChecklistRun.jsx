import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../data/AppContext.jsx';
import { store } from '../data/store.js';
import { can } from '../lib/access.js';
import { CHECKPOINT_LABEL } from '../lib/constants.js';
import { fmtDate, nowIso } from '../lib/dates.js';
import { Card, Field, toast } from '../components/ui.jsx';
import { RUN_STATUS } from './Checklists.jsx';

export default function ChecklistRun() {
  const [q] = useSearchParams();
  const { data, member, reload } = useApp();
  const date = q.get('date'); const dp = q.get('dp'); const areaId = q.get('area'); const cp = q.get('cp');
  const runId = `${date}_${dp}_${areaId}_${cp}`;
  const area = data.areas.find((a) => a.id === areaId);
  const items = data.checklistItems.filter((i) => i.areaId === areaId && i.checkpoint === cp);
  const run = data.checklistRuns.find((r) => r.id === runId);
  const [state, setState] = useState(run?.items || {});
  const [verifyNote, setVerifyNote] = useState('');
  const [busy, setBusy] = useState(false);
  const status = run?.status || 'open';
  const name = (id) => data.people.find((p) => p.id === id)?.name || '—';

  const canOversee = can.oversee(member);
  const canVerify = can.verify(member);
  const locked = status === 'verified' || (status === 'overseen' && !canVerify && member.role !== 'admin');
  const editable = canOversee && status !== 'verified';
  const requiredLeft = items.filter((i) => i.required && !state[i.id]?.done).length;

  const base = { areaId, date, daypart: dp, checkpoint: cp };
  const save = async (patch) => {
    setBusy(true);
    try {
      await store.set('checklistRuns', runId, { ...base, ...patch }, true);
      await reload();
    } catch (e) { toast(`Couldn't save: ${e.message}`); }
    setBusy(false);
  };

  const toggle = (id, field, value) => setState((s) => ({ ...s, [id]: { ...s[id], [field]: value } }));

  const oversee = async () => {
    if (requiredLeft) { toast(`${requiredLeft} required item(s) not done yet`); return; }
    await save({ items: state, status: 'overseen', overseenById: member.personId, overseenAt: nowIso() });
    toast('Marked overseen. Shift Leader will verify.');
  };
  const verify = async (result) => {
    if (result === 'sent_back' && !verifyNote.trim()) { toast('Add a note saying what to fix'); return; }
    await save({ status: result, verifiedById: member.personId, verifiedAt: nowIso(), verifyResult: result, verifyNote });
    toast(result === 'verified' ? 'Verified ✓' : 'Sent back');
  };

  const [label, tone] = RUN_STATUS[status] || RUN_STATUS.open;
  return (
    <>
      <p style={{ marginTop: 12 }}><Link to="/checklists">← Checklists</Link></p>
      <div className="row between">
        <h1 style={{ margin: 0 }}>{area?.name} · {CHECKPOINT_LABEL[cp]}</h1>
        <span className={`pill ${tone}`}>{label}</span>
      </div>
      <p className="muted small">{fmtDate(date)} · {dp}</p>

      {status === 'sent_back' && (
        <Card tight><b>Sent back by {name(run.verifiedById)}:</b> {run.verifyNote}</Card>
      )}

      <Card tight>
        {items.length === 0 && <p className="muted">No items for this checkpoint yet (TBD).</p>}
        {items.map((it) => {
          const s = state[it.id] || {};
          return (
            <div className="check" key={it.id}>
              <input type="checkbox" checked={!!s.done} disabled={!editable || locked} onChange={(e) => toggle(it.id, 'done', e.target.checked)} aria-label={it.text} />
              <div className="grow">
                <div>{it.text} {it.required && <span className="muted small">(required)</span>}</div>
                {editable && !locked ? (
                  <div className="btns" style={{ marginTop: 6 }}>
                    <input placeholder="Who did it" value={s.doneBy || ''} onChange={(e) => toggle(it.id, 'doneBy', e.target.value)} />
                    <input placeholder="Note" value={s.note || ''} onChange={(e) => toggle(it.id, 'note', e.target.value)} />
                  </div>
                ) : (
                  (s.doneBy || s.note) && <div className="small muted">{s.doneBy}{s.note ? ` · ${s.note}` : ''}</div>
                )}
              </div>
            </div>
          );
        })}
      </Card>

      {run?.overseenById && <p className="small muted">Overseen by {name(run.overseenById)} {fmtDate(run.overseenAt)}</p>}
      {run?.verifiedById && status === 'verified' && <p className="small muted">Verified by {name(run.verifiedById)} {fmtDate(run.verifiedAt)}{run.verifyNote ? ` · ${run.verifyNote}` : ''}</p>}

      {editable && !locked && items.length > 0 && (
        <div className="stack">
          <button className="btn secondary" disabled={busy} onClick={() => save({ items: state, status: status === 'sent_back' ? 'sent_back' : 'open' })}>Save progress</button>
          <button className="btn" disabled={busy} onClick={oversee}>Mark overseen{requiredLeft ? ` (${requiredLeft} left)` : ''}</button>
        </div>
      )}

      {canVerify && status === 'overseen' && (
        <Card title="Verify">
          <Field label="Note (required to send back)"><textarea value={verifyNote} onChange={(e) => setVerifyNote(e.target.value)} /></Field>
          <div className="btns" style={{ marginTop: 10 }}>
            <button className="btn secondary" disabled={busy} onClick={() => verify('sent_back')}>Send back</button>
            <button className="btn ok" disabled={busy} onClick={() => verify('verified')}>Verify ✓</button>
          </div>
        </Card>
      )}
      {canVerify && status !== 'overseen' && status !== 'verified' && <p className="small muted">Waiting for the Captain to mark this overseen.</p>}
    </>
  );
}
