import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../data/AppContext.jsx';
import { store } from '../data/store.js';
import { nowIso } from '../lib/dates.js';
import { TARGET_ROLES } from '../lib/constants.js';
import { Card, Field, Seg, toast } from '../components/ui.jsx';

// Application of interest (learner submits for themself)
export default function Apply() {
  const { data, me, member, reload } = useApp();
  const nav = useNavigate();
  const [f, setF] = useState({ targetRole: me?.pipelineTarget || 'Area Captain', areaPref: me?.areaId || '', daypartPref: me?.daypart || '', why: '' });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!f.why.trim()) { toast('Tell us why you want the role'); return; }
    setBusy(true);
    try {
      await store.add('applications', { personId: member.personId, ...f, submittedAt: nowIso(), status: 'submitted', source: 'app' });
      await reload();
      toast('Application sent to Joshua');
      nav(`/people/${member.personId}`);
    } catch (e) { toast(`Couldn't send: ${e.message}`); setBusy(false); }
  };
  return (
    <>
      <h1 style={{ marginTop: 12 }}>Application of interest</h1>
      <Card tight>
        <Field label="Role"><select value={f.targetRole} onChange={(e) => setF({ ...f, targetRole: e.target.value })}>{TARGET_ROLES.map((r) => <option key={r}>{r}</option>)}</select></Field>
        <Field label="Area you'd like"><select value={f.areaPref} onChange={(e) => setF({ ...f, areaPref: e.target.value })}><option value="">No preference</option>{data.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        <Field label="Daypart you'd like"><Seg value={f.daypartPref} options={[['', 'Either'], 'AM', 'PM']} onChange={(v) => setF({ ...f, daypartPref: v })} /></Field>
        <Field label="Why do you want this role?"><textarea value={f.why} onChange={(e) => setF({ ...f, why: e.target.value })} style={{ minHeight: 120 }} /></Field>
      </Card>
      <button className="btn" disabled={busy} onClick={submit}>Submit</button>
    </>
  );
}
