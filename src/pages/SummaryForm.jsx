import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../data/AppContext.jsx';
import { store } from '../data/store.js';
import { checklistGrid } from '../lib/rules.js';
import { CHECKPOINT_LABEL } from '../lib/constants.js';
import { fmtDate, nowIso } from '../lib/dates.js';
import { Card, Field, Seg, Tbd, toast } from '../components/ui.jsx';
import { RUN_STATUS } from './Checklists.jsx';

export function summaryText(s, people) {
  const name = people.find((p) => p.id === s.shiftLeaderId)?.name || '';
  const grid = (s.checklistStatus || []).map((a) => `${a.area}: ${a.cells.map((c) => `${CHECKPOINT_LABEL[c.checkpoint]} ${c.label}`).join(', ')}`).join('\n');
  return `End-of-shift summary ${fmtDate(s.date)} ${s.daypart} (${name})\n\nChecklists:\n${grid}\n\nWins: ${s.wins || '-'}\nIssues: ${s.issues || '-'}\nPeople: ${s.peopleNotes || '-'}\nFollow-ups: ${s.followUps || '-'}`;
}

export default function SummaryForm() {
  const { data, member, reload } = useApp();
  const nav = useNavigate();
  const [dp, setDp] = useState(new Date().getHours() < 15 ? 'AM' : 'PM');
  const [date, setDate] = useState(data.today);
  const [f, setF] = useState({ wins: '', issues: '', peopleNotes: '', followUps: '' });
  const [sent, setSent] = useState(null);
  const [busy, setBusy] = useState(false);
  const grid = checklistGrid(date, dp, data);
  const contact = data.settings?.summaryContact || {};
  const existing = data.summaries.find((s) => s.date === date && s.daypart === dp && s.shiftLeaderId === member.personId);

  const checklistStatus = grid.map((g) => ({
    areaId: g.area.id, area: g.area.name,
    cells: g.cells.map((c) => ({ checkpoint: c.checkpoint, status: c.status, label: c.itemCount ? RUN_STATUS[c.status][0] : 'TBD' })),
  }));

  const submit = async () => {
    setBusy(true);
    try {
      const doc = { date, daypart: dp, shiftLeaderId: member.personId, checklistStatus, ...f, submittedAt: nowIso(), readAt: null };
      await store.add('summaries', doc);
      await reload();
      setSent(doc);
      toast('Sent to Joshua’s inbox');
    } catch (e) { toast(`Couldn't send: ${e.message}`); }
    setBusy(false);
  };

  if (sent) {
    const body = encodeURIComponent(summaryText(sent, data.people));
    return (
      <>
        <h1 style={{ marginTop: 12 }}>Summary sent ✓</h1>
        <p>It's in Joshua's inbox in the app.</p>
        <p className="muted small">Want to also text or email it?</p>
        <div className="stack">
          {contact.phone ? <a className="btn secondary" href={`sms:${contact.phone}?&body=${body}`}>Text it to Joshua</a> : null}
          {contact.email ? <a className="btn secondary" href={`mailto:${contact.email}?subject=${encodeURIComponent(`EOS summary ${fmtDate(sent.date)} ${sent.daypart}`)}&body=${body}`}>Email it to Joshua</a> : null}
          {!contact.phone && !contact.email && <p className="small muted">(Joshua can add his phone/email in Admin → Settings to turn on these buttons.)</p>}
          <button className="btn" onClick={() => nav('/')}>Done</button>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 style={{ marginTop: 12 }}>End-of-shift summary</h1>
      <Card tight>
        <div className="btns">
          <Field label="Date"><input type="date" value={date} max={data.today} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Daypart"><Seg value={dp} options={['AM', 'PM']} onChange={setDp} /></Field>
        </div>
        {existing && <p className="small" style={{ color: 'var(--warn)' }}>You already sent one for this shift. Sending again adds a second one.</p>}
      </Card>
      <Card title="Checklists (auto)">
        <table className="grid-status">
          <thead><tr><th>Area</th>{grid[0]?.cells.map((c) => <th key={c.checkpoint}>{CHECKPOINT_LABEL[c.checkpoint]}</th>)}</tr></thead>
          <tbody>
            {grid.map((g) => (
              <tr key={g.area.id}>
                <td>{g.area.name}</td>
                {g.cells.map((c) => <td key={c.checkpoint}>{c.itemCount ? <span className={`pill ${RUN_STATUS[c.status][1]}`}>{RUN_STATUS[c.status][0].replace(' · verify', '')}</span> : <Tbd />}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card tight>
        <Field label="Wins"><textarea value={f.wins} onChange={(e) => setF({ ...f, wins: e.target.value })} /></Field>
        <Field label="Issues"><textarea value={f.issues} onChange={(e) => setF({ ...f, issues: e.target.value })} /></Field>
        <Field label="People (who stood out, who needs coaching)"><textarea value={f.peopleNotes} onChange={(e) => setF({ ...f, peopleNotes: e.target.value })} /></Field>
        <Field label="Follow-ups"><textarea value={f.followUps} onChange={(e) => setF({ ...f, followUps: e.target.value })} /></Field>
      </Card>
      <button className="btn" onClick={submit} disabled={busy}>{busy ? 'Sending…' : 'Send to Joshua'}</button>
    </>
  );
}
