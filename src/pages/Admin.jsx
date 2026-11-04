import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../data/AppContext.jsx';
import { store, demoMode } from '../data/store.js';
import { defaultAppRole } from '../lib/access.js';
import { toCsv } from '../lib/csv.js';
import { areaCoverage } from '../lib/rules.js';
import {
  APP_ROLES, ATTENDANCE_LABEL, ATTENDANCE_STATUSES, PERSON_ROLES, TARGET_ROLES,
} from '../lib/constants.js';
import { fmtDate } from '../lib/dates.js';
import { Card, Field, Pill, Seg, Tbd, toast } from '../components/ui.jsx';

const TABS = [['team', 'Team access'], ['people', 'People'], ['attendance', 'Attendance'], ['areas', 'Areas'], ['settings', 'Rules & TBDs'], ['records', 'Applications'], ['export', 'Export']];

function useSave() {
  const { reload } = useApp();
  return async (fn, msg) => {
    try { await fn(); await reload(); if (msg) toast(msg); return true; } catch (e) { toast(`Couldn't save: ${e.message}`); return false; }
  };
}

export default function Admin() {
  const [tab, setTab] = useState('team');
  return (
    <>
      <h1 style={{ marginTop: 12 }}>Admin</h1>
      <div className="tabs">{TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'team' && <TeamAccess />}
      {tab === 'people' && <People />}
      {tab === 'attendance' && <AttendanceBulk />}
      {tab === 'areas' && <Areas />}
      {tab === 'settings' && <Settings />}
      {tab === 'records' && <Applications />}
      {tab === 'export' && <Export />}
    </>
  );
}

// ---------------- Team access (who can sign in, and their app role) ----------------
function TeamAccess() {
  const { data, member } = useApp();
  const save = useSave();
  const [f, setF] = useState({ email: '', personId: '', role: '', isManager: false });
  const name = (pid) => data.people.find((p) => p.id === pid)?.name || '—';
  const pick = (pid) => { const p = data.people.find((x) => x.id === pid); setF({ ...f, personId: pid, role: p ? defaultAppRole(p) : '', isManager: !!p?.isManager }); };

  const add = async () => {
    const email = f.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('Enter their Google email'); return; }
    if (!f.personId || !f.role) { toast('Pick the person and role'); return; }
    if (await save(() => store.set('members', email, { email, personId: f.personId, role: f.role, isManager: f.isManager, active: true }), 'Access added')) setF({ email: '', personId: '', role: '', isManager: false });
  };

  return (
    <>
      <Card title="Who can sign in">
        <p className="small muted" style={{ marginTop: 0 }}>Each person signs in with Google. Add the exact Google email they use. Their role decides what they can see and do.</p>
        <table className="simple">
          <tbody>
            {data.members.sort((a, b) => name(a.personId).localeCompare(name(b.personId))).map((m) => (
              <tr key={m.id}>
                <td><b>{name(m.personId)}</b><div className="small muted">{m.email}</div></td>
                <td>
                  <select value={m.role} disabled={m.id === member.email} onChange={(e) => save(() => store.update('members', m.id, { role: e.target.value }), 'Role updated')}>
                    {Object.entries(APP_ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <label className="row small" style={{ fontWeight: 400, margin: '4px 0 0' }}><input type="checkbox" checked={!!m.isManager} disabled={m.id === member.email} onChange={(e) => save(() => store.update('members', m.id, { isManager: e.target.checked }), 'Updated')} /> Manager (can score shifts)</label>
                </td>
                <td className="right">{m.id !== member.email && <button className="btn link small" onClick={() => confirm(`Remove sign-in access for ${m.email}?`) && save(() => store.remove('members', m.id), 'Access removed')}>Remove</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="Add someone">
        <Field label="Google email"><input type="email" autoCapitalize="none" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="name@gmail.com" /></Field>
        <Field label="Person"><select value={f.personId} onChange={(e) => pick(e.target.value)}><option value="">Pick…</option>{data.people.filter((p) => p.active !== false).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.currentRole})</option>)}</select></Field>
        <Field label="App role"><select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="">Pick…</option>{Object.entries(APP_ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <label className="row" style={{ fontWeight: 500 }}><input type="checkbox" checked={f.isManager} onChange={(e) => setF({ ...f, isManager: e.target.checked })} /> Manager (can score evaluation/training shifts)</label>
        <button className="btn" style={{ marginTop: 10 }} onClick={add}>Add access</button>
        <p className="small muted">Not on the list yet? Add them under People first.</p>
      </Card>
    </>
  );
}

// ---------------- People ----------------
function People() {
  const { data } = useApp();
  const save = useSave();
  const [edit, setEdit] = useState(null);
  const blank = { name: '', currentRole: 'Team Member', areaId: '', daypart: '', pipelineTarget: '', isManager: false, isCertifiedTrainer: false, active: true, notes: '' };

  const submit = async () => {
    if (!edit.name.trim()) { toast('Name required'); return; }
    const doc = { ...edit, areaId: edit.areaId || null, daypart: edit.daypart || null, pipelineTarget: edit.pipelineTarget || null, isAdmin: edit.currentRole === 'Admin' || !!edit.isAdmin };
    delete doc.id;
    const ok = await save(async () => {
      if (edit.id) {
        // Keep role history matching the person, since days as a Captain are counted from it.
        const before = data.people.find((p) => p.id === edit.id);
        const open = data.roleHistory.filter((h) => h.personId === edit.id && !h.endDate);
        if (before.currentRole !== doc.currentRole) {
          for (const h of open) await store.update('roleHistory', h.id, { endDate: data.today });
          await store.add('roleHistory', { personId: edit.id, role: doc.currentRole, areaId: doc.areaId, daypart: doc.daypart, startDate: data.today, endDate: null, reason: 'Changed in Admin' });
          doc.roleStartDate = data.today;
        } else {
          for (const h of open.filter((x) => x.role === doc.currentRole)) await store.update('roleHistory', h.id, { areaId: doc.areaId, daypart: doc.daypart });
        }
        await store.update('people', edit.id, doc);
      } else {
        const newId = `P${String(Date.now()).slice(-6)}`;
        await store.set('people', newId, { ...doc, prereqOverrides: {}, pathwayComplete: {}, roleStartDate: null });
        await store.add('roleHistory', { personId: newId, role: doc.currentRole, areaId: doc.areaId, daypart: doc.daypart, startDate: null, endDate: null, reason: 'Added in Admin' });
      }
    }, 'Saved');
    if (ok) setEdit(null);
  };

  if (edit) {
    return (
      <Card title={edit.id ? `Edit ${edit.name}` : 'Add person'}>
        <Field label="Name"><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
        <Field label="Current role"><select value={edit.currentRole} onChange={(e) => setEdit({ ...edit, currentRole: e.target.value })}>{PERSON_ROLES.map((r) => <option key={r}>{r}</option>)}</select></Field>
        <Field label="Area"><select value={edit.areaId || ''} onChange={(e) => setEdit({ ...edit, areaId: e.target.value })}><option value="">All / none</option>{data.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        <Field label="Daypart"><Seg value={edit.daypart || ''} options={[['', 'TBD / All'], 'AM', 'PM']} onChange={(v) => setEdit({ ...edit, daypart: v })} /></Field>
        <Field label="Working toward"><select value={edit.pipelineTarget || ''} onChange={(e) => setEdit({ ...edit, pipelineTarget: e.target.value })}><option value="">Not in pipeline</option>{TARGET_ROLES.map((r) => <option key={r}>{r}</option>)}</select></Field>
        <label className="row" style={{ fontWeight: 500 }}><input type="checkbox" checked={!!edit.isManager} onChange={(e) => setEdit({ ...edit, isManager: e.target.checked })} /> Manager (letters from all managers; can score shifts)</label>
        <label className="row" style={{ fontWeight: 500 }}><input type="checkbox" checked={!!edit.isCertifiedTrainer} onChange={(e) => setEdit({ ...edit, isCertifiedTrainer: e.target.checked })} /> Certified trainer</label>
        <label className="row" style={{ fontWeight: 500 }}><input type="checkbox" checked={edit.active !== false} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Active</label>
        <Field label="Notes"><textarea value={edit.notes || ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
        <div className="btns" style={{ marginTop: 10 }}><button className="btn secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn" onClick={submit}>Save</button></div>
        {edit.id && <p className="small muted">Changing the role here ends their old role and starts the new one today. For a promotion, use Promote on their profile.</p>}
      </Card>
    );
  }
  return (
    <Card title="People" right={<button className="btn small" onClick={() => setEdit(blank)}>Add</button>}>
      {data.people.map((p) => (
        <div key={p.id} className="list-link">
          <Link to={`/people/${p.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
            <b>{p.name}</b> {p.active === false && <Pill>inactive</Pill>}<br />
            <span className="small muted">{p.currentRole}{p.areaId ? ` · ${data.areas.find((a) => a.id === p.areaId)?.name}` : ''} · {p.daypart || 'TBD/All'}{p.pipelineTarget ? ` → ${p.pipelineTarget}` : ''}{p.isManager ? ' · Manager' : ''}</span>
          </Link>
          <button className="btn link small" onClick={() => setEdit({ ...blank, ...p })}>Edit</button>
        </div>
      ))}
    </Card>
  );
}

// ---------------- Attendance (bulk entry for one date) ----------------
function AttendanceBulk() {
  const { data } = useApp();
  const save = useSave();
  const [date, setDate] = useState(data.today);
  const tracked = data.people.filter((p) => p.active !== false && !['Admin', 'Manager'].includes(p.currentRole));
  const existing = data.attendance.filter((a) => a.date === date);
  const [vals, setVals] = useState({});
  const val = (pid) => vals[pid] ?? existing.find((a) => a.personId === pid)?.status ?? '';

  const submit = async () => {
    const changes = Object.entries(vals);
    if (!changes.length) { toast('Nothing changed'); return; }
    await save(async () => {
      for (const [pid, status] of changes) {
        const ex = existing.find((a) => a.personId === pid);
        if (!status && ex) await store.remove('attendance', ex.id);
        else if (ex) await store.update('attendance', ex.id, { status });
        else if (status) await store.add('attendance', { personId: pid, date, status, source: 'manual' });
      }
    }, 'Attendance saved');
    setVals({});
  };

  return (
    <Card title="Enter attendance">
      <Field label="Shift date"><input type="date" value={date} max={data.today} onChange={(e) => { setDate(e.target.value); setVals({}); }} /></Field>
      <p className="small muted">Pick a result for each person who was scheduled. Leave blank if they weren't scheduled. (For clock-in times, use Add shift on their profile.)</p>
      {tracked.map((p) => (
        <div key={p.id} style={{ margin: '10px 0' }}>
          <b>{p.name}</b>
          <Seg value={val(p.id)} options={[['', '—'], ...ATTENDANCE_STATUSES.map((s) => [s, ATTENDANCE_LABEL[s]])]} onChange={(v) => setVals({ ...vals, [p.id]: v })} />
        </div>
      ))}
      <button className="btn" onClick={submit}>Save</button>
      <p className="small muted">Time-punch CSV import is planned for Phase 2.</p>
    </Card>
  );
}

// ---------------- Areas ----------------
function Areas() {
  const { data } = useApp();
  const save = useSave();
  const names = (list) => (list.length ? list.map((p) => p.name).join(', ') : 'Open');
  return data.areas.map((a) => {
    const c = areaCoverage(a, data.people);
    return (
      <Card key={a.id} title={a.name}>
        <p className="small" style={{ marginTop: 0 }}>Area Captain: <b>{names(c.captains)}</b><br />Assistant Captain: <b>{names(c.assistants)}</b>{c.potentials.length ? <><br />Potential Assistant Captain: <b>{names(c.potentials)}</b></> : null}</p>
        <p className="small muted">To change who's here, edit the person under People.</p>
        <Field label="Assistant Captain daypart" hint="Covers the daypart the Captain isn't working."><Seg value={a.assistantDaypart || ''} options={[['', 'TBD'], 'AM', 'PM']} onChange={(v) => save(() => store.update('areas', a.id, { assistantDaypart: v || null }), 'Saved')} /></Field>
      </Card>
    );
  });
}

// ---------------- Rules & TBD settings ----------------
function Settings() {
  const { data } = useApp();
  const save = useSave();
  const s = data.settings;
  const [draft, setDraft] = useState(() => structuredClone(s));
  const set = (fn) => setDraft((d) => { const c = structuredClone(d); fn(c); return c; });
  const num = (v) => (v === '' || v == null ? null : Number(v));
  const t = draft.tbd || {};

  const prereqRows = (key) => (draft.roles[key].prerequisites || []).map((pr, i) => (
    pr.value != null && (
      <Field key={pr.id} label={pr.label}>
        <input inputMode="decimal" value={pr.value} onChange={(e) => set((d) => { d.roles[key].prerequisites[i].value = num(e.target.value); })} />
      </Field>
    )
  ));

  const tbdNote = (v, def) => (v == null ? <span className="small"><Tbd /> {def ? `using default: ${def}` : 'not set'}</span> : null);

  return (
    <>
      <Card title="Area Captain">
        {prereqRows('area_captain')}
        <Field label="Evaluation shifts pass % (TBD: Joshua decides until set)"><input inputMode="decimal" value={draft.roles.area_captain.shifts.pass_pct ?? ''} placeholder="TBD" onChange={(e) => set((d) => { d.roles.area_captain.shifts.pass_pct = num(e.target.value); })} /></Field>
        <Field label="Evaluation shift score sheet"><textarea value={t.evalScoreSheet || ''} placeholder="TBD" onChange={(e) => set((d) => { d.tbd.evalScoreSheet = e.target.value || null; })} /></Field>
        <p className="small muted">Raise for the role: <Tbd /> (no pay data is stored in this app)</p>
      </Card>
      <Card title="Shift Leader">
        {prereqRows('shift_leader')}
        <Field label="Training shifts pass % (sum earned ÷ sum possible)"><input inputMode="decimal" value={draft.roles.shift_leader.shifts.pass_pct ?? ''} onChange={(e) => set((d) => { d.roles.shift_leader.shifts.pass_pct = num(e.target.value); })} /></Field>
        <Field label="Training shift score sheet"><textarea value={t.trainingScoreSheet || ''} placeholder="TBD" onChange={(e) => set((d) => { d.tbd.trainingScoreSheet = e.target.value || null; })} /></Field>
        <Field label="Assistant Captain days count toward “60 days as Captain”?">
          <Seg value={t.assistantDaysCount == null ? '' : t.assistantDaysCount ? 'yes' : 'no'} options={[['', 'TBD'], ['no', 'No'], ['yes', 'Yes']]} onChange={(v) => set((d) => { d.tbd.assistantDaysCount = v === '' ? null : v === 'yes'; })} />
          {tbdNote(t.assistantDaysCount, 'no')}
        </Field>
      </Card>
      <Card title="Assistant Captain">
        <p className="small"><Tbd /> Prerequisites aren't defined. Tell Claude when you decide them and they'll be added as rules.</p>
      </Card>
      <Card title="P5 Evaluation">
        <div className="btns">
          <Field label="Pass score (of 80)"><input inputMode="numeric" value={draft.p5.pass_score} onChange={(e) => set((d) => { d.p5.pass_score = num(e.target.value); d.p5.pass_pct = (num(e.target.value) / d.p5.max_score) * 100; })} /></Field>
          <Field label="Coaching flag: P average under"><input inputMode="decimal" value={draft.p5.coaching_avg} onChange={(e) => set((d) => { d.p5.coaching_avg = num(e.target.value); })} /></Field>
        </div>
        <Field label="Which P5 counts for the prerequisite">
          <Seg value={t.p5Counts || ''} options={[['', 'TBD'], ['latest', 'Latest'], ['best', 'Best']]} onChange={(v) => set((d) => { d.tbd.p5Counts = v || null; })} />
          {tbdNote(t.p5Counts, 'latest')}
        </Field>
      </Card>
      <Card title="Attendance">
        <Field label="Window (days)"><input inputMode="numeric" value={draft.attendance.window_days} onChange={(e) => set((d) => { d.attendance.window_days = num(e.target.value); })} /></Field>
        <Field label="On time = clocked in within this many minutes of start"><input inputMode="numeric" value={t.onTimeGraceMinutes ?? ''} placeholder="TBD" onChange={(e) => set((d) => { d.tbd.onTimeGraceMinutes = num(e.target.value); })} />{tbdNote(t.onTimeGraceMinutes, 'at or before start (0)')}</Field>
        <Field label="Excused absences">
          <select value={t.excusedHandling || ''} onChange={(e) => set((d) => { d.tbd.excusedHandling = e.target.value || null; })}>
            <option value="">TBD</option><option value="exclude">Don't count them</option><option value="count_as_on_time">Count as on time</option><option value="count_as_missed">Count as missed</option>
          </select>
          {tbdNote(t.excusedHandling, "don't count them")}
        </Field>
      </Card>
      <Card title="Dayparts">
        <div className="btns">
          <Field label="AM daypart times"><input value={t.daypartTimes?.AM || ''} placeholder="TBD" onChange={(e) => set((d) => { d.tbd.daypartTimes = { ...d.tbd.daypartTimes, AM: e.target.value || null }; })} /></Field>
          <Field label="PM daypart times"><input value={t.daypartTimes?.PM || ''} placeholder="TBD" onChange={(e) => set((d) => { d.tbd.daypartTimes = { ...d.tbd.daypartTimes, PM: e.target.value || null }; })} /></Field>
        </div>
      </Card>
      <Card title="Where shift summaries can be texted/emailed">
        <p className="small muted" style={{ marginTop: 0 }}>Summaries always land in your in-app Inbox. Add these to show “Text it / Email it” buttons for Shift Leaders.</p>
        <Field label="Your phone"><input type="tel" value={draft.summaryContact?.phone || ''} onChange={(e) => set((d) => { d.summaryContact = { ...d.summaryContact, phone: e.target.value }; })} /></Field>
        <Field label="Your email"><input type="email" value={draft.summaryContact?.email || ''} onChange={(e) => set((d) => { d.summaryContact = { ...d.summaryContact, email: e.target.value }; })} /></Field>
      </Card>
      <button className="btn" onClick={() => { const { id, ...rest } = draft; save(() => store.set('settings', 'rules', rest, true), 'Rules saved: readiness updated everywhere'); }}>Save rules</button>
      <p className="small muted">Loaded from prerequisites.json (version {s.version}).</p>
    </>
  );
}

// ---------------- Applications log ----------------
function Applications() {
  const { data } = useApp();
  const name = (pid) => data.people.find((p) => p.id === pid)?.name || '—';
  const apps = [...data.applications].sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
  const letters = [...data.letters].sort((a, b) => (b.dateReceived || '').localeCompare(a.dateReceived || ''));
  return (
    <>
      <Card title="Applications of interest">
        {apps.length === 0 && <p className="muted">None yet.</p>}
        {apps.map((a) => (
          <Link key={a.id} to={`/people/${a.personId}`} className="list-link">
            <span><b>{name(a.personId)}</b> → {a.targetRole}<br /><span className="small muted">{fmtDate(a.submittedAt)} · {a.source === 'paper' ? 'paper' : 'in app'}</span></span>
            <Pill tone={a.status === 'reviewed' ? 'ok' : 'warn'}>{a.status}</Pill>
          </Link>
        ))}
      </Card>
      <Card title="Recommendation letters">
        {letters.length === 0 && <p className="muted">None yet. Log them from each person's profile.</p>}
        {letters.map((l) => (
          <Link key={l.id} to={`/people/${l.personId}`} className="list-link">
            <span><b>{name(l.personId)}</b> from {l.authorName}<br /><span className="small muted">{l.authorRole} · {fmtDate(l.dateReceived)} · for {l.targetRole}</span></span>
          </Link>
        ))}
      </Card>
    </>
  );
}

// ---------------- Export ----------------
function Export() {
  const { data } = useApp();
  const cols = ['people', 'areas', 'attendance', 'letters', 'applications', 'p5Evals', 'shifts', 'roleHistory', 'coaching', 'summaries', 'p5Items', 'members'];
  const download = (name, text, type) => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <Card title="Export / backup">
      <button className="btn" onClick={() => download(`boh-leaders-${data.today}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), settings: data.settings, ...Object.fromEntries(cols.map((c) => [c, data[c]])) }, null, 2), 'application/json')}>Download everything (JSON)</button>
      <p className="small muted">Or one sheet at a time (CSV, opens in Excel / Google Sheets):</p>
      <div className="row wrap">
        {cols.map((c) => <button key={c} className="btn secondary small" onClick={() => download(`${c}-${data.today}.csv`, toCsv(data[c]), 'text/csv')}>{c} ({data[c].length})</button>)}
      </div>
      <p className="small muted">Attendance export covers the last 180 days.{demoMode ? ' (Demo data)' : ''}</p>
    </Card>
  );
}
