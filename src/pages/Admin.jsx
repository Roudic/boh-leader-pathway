import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../data/AppContext.jsx';
import { store, demoMode } from '../data/store.js';
import { defaultAppRole } from '../lib/access.js';
import { parseCsv, toCsv } from '../lib/csv.js';
import {
  APP_ROLES, ATTENDANCE_LABEL, ATTENDANCE_STATUSES, CHECKPOINTS, CHECKPOINT_LABEL, PERSON_ROLES, TARGET_ROLES,
} from '../lib/constants.js';
import { fmtDate } from '../lib/dates.js';
import { Card, Field, Pill, Seg, Tbd, toast } from '../components/ui.jsx';
import { PATHWAY_LABEL } from './Pathways.jsx';

const TABS = [['team', 'Team access'], ['people', 'People'], ['attendance', 'Attendance'], ['areas', 'Areas'], ['checklists', 'Checklists'], ['pathways', 'Pathways'], ['settings', 'Rules & TBDs'], ['records', 'Applications'], ['export', 'Export']];

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
      {tab === 'checklists' && <ChecklistItems />}
      {tab === 'pathways' && <PathwaysEditor />}
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
      if (edit.id) await store.update('people', edit.id, doc);
      else {
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
        {edit.id && <p className="small muted">To change someone's role because of a promotion, use Promote on their profile so their role history is kept.</p>}
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
  const opt = (filter) => [<option key="" value="">Open</option>, ...data.people.filter(filter).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)];
  const active = (p) => p.active !== false;
  return data.areas.map((a) => (
    <Card key={a.id} title={a.name}>
      <Field label="Area Captain"><select value={a.captainId || ''} onChange={(e) => save(() => store.update('areas', a.id, { captainId: e.target.value || null }), 'Saved')}>{opt(active)}</select></Field>
      <Field label="Assistant Captain"><select value={a.assistantCaptainId || ''} onChange={(e) => save(() => store.update('areas', a.id, { assistantCaptainId: e.target.value || null }), 'Saved')}>{opt(active)}</select></Field>
      <Field label="Potential Assistant Captain"><select value={a.potentialAssistantId || ''} onChange={(e) => save(() => store.update('areas', a.id, { potentialAssistantId: e.target.value || null }), 'Saved')}>{opt(active)}</select></Field>
      <Field label="Assistant Captain daypart" hint="Covers the daypart the Captain isn't working."><Seg value={a.assistantDaypart || ''} options={[['', 'TBD'], 'AM', 'PM']} onChange={(v) => save(() => store.update('areas', a.id, { assistantDaypart: v || null }), 'Saved')} /></Field>
    </Card>
  ));
}

// ---------------- Checklist items ----------------
function ChecklistItems() {
  const { data } = useApp();
  const save = useSave();
  const [areaId, setAreaId] = useState(data.areas[0]?.id);
  const [cp, setCp] = useState('open');
  const [text, setText] = useState('');
  const [csv, setCsv] = useState('');
  const items = data.checklistItems.filter((i) => i.areaId === areaId && i.checkpoint === cp).sort((a, b) => a.order - b.order);

  const add = async () => {
    if (!text.trim()) return;
    if (await save(() => store.add('checklistItems', { areaId, checkpoint: cp, order: (items.at(-1)?.order || 0) + 1, text: text.trim(), required: true }), 'Item added')) setText('');
  };
  const move = (i, dir) => {
    const other = items[i + dir];
    if (!other) return;
    save(async () => { await store.update('checklistItems', items[i].id, { order: other.order }); await store.update('checklistItems', other.id, { order: items[i].order }); });
  };
  const importCsv = async () => {
    const ids = Object.fromEntries(data.areas.map((a) => [a.name.toLowerCase(), a.id]));
    const rows = parseCsv(csv).filter((r) => ids[r.area?.toLowerCase()] && CHECKPOINTS.includes(r.checkpoint) && r.item_text);
    if (!rows.length) { toast('No valid rows (columns: area,checkpoint,item_order,item_text,required,notes)'); return; }
    if (await save(async () => {
      for (const r of rows) await store.add('checklistItems', { areaId: ids[r.area.toLowerCase()], checkpoint: r.checkpoint, order: Number(r.item_order) || 99, text: r.item_text, required: !/^(false|no|0)$/i.test(r.required || '') });
    }, `Imported ${rows.length} items`)) setCsv('');
  };

  return (
    <>
      <Card tight>
        <Field label="Area"><Seg value={areaId} options={data.areas.map((a) => [a.id, a.name])} onChange={setAreaId} /></Field>
        <Field label="Checkpoint"><Seg value={cp} options={CHECKPOINTS.map((c) => [c, CHECKPOINT_LABEL[c]])} onChange={setCp} /></Field>
      </Card>
      <Card title={`${data.areas.find((a) => a.id === areaId)?.name} · ${CHECKPOINT_LABEL[cp]}`}>
        {items.length === 0 && <p className="muted">No items yet (TBD).</p>}
        {items.map((it, i) => (
          <div key={it.id} className="check">
            <div className="grow">
              <input defaultValue={it.text} onBlur={(e) => e.target.value !== it.text && save(() => store.update('checklistItems', it.id, { text: e.target.value }), 'Saved')} />
              <label className="row small" style={{ fontWeight: 400, margin: '4px 0 0' }}><input type="checkbox" checked={it.required} onChange={(e) => save(() => store.update('checklistItems', it.id, { required: e.target.checked }))} /> Required</label>
            </div>
            <div className="row">
              <button className="btn link" onClick={() => move(i, -1)} aria-label="Move up">↑</button>
              <button className="btn link" onClick={() => move(i, 1)} aria-label="Move down">↓</button>
              <button className="btn link" onClick={() => confirm('Delete this item?') && save(() => store.remove('checklistItems', it.id), 'Deleted')} aria-label="Delete">✕</button>
            </div>
          </div>
        ))}
        <div className="row" style={{ marginTop: 10 }}>
          <input className="grow" value={text} onChange={(e) => setText(e.target.value)} placeholder="New item…" onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button className="btn small" onClick={add}>Add</button>
        </div>
      </Card>
      <Card title="Import from CSV">
        <p className="small muted" style={{ marginTop: 0 }}>Paste rows using the areas_checklist_template.csv columns: area,checkpoint,item_order,item_text,required,notes</p>
        <textarea value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={'area,checkpoint,item_order,item_text,required,notes\nPrep,open,1,...,true,'} />
        <button className="btn small" style={{ marginTop: 8 }} onClick={importCsv}>Import</button>
      </Card>
      <Card title="Which checkpoints run in which daypart">
        <CheckpointsByDaypart />
      </Card>
    </>
  );
}

function CheckpointsByDaypart() {
  const { data } = useApp();
  const save = useSave();
  const map = data.settings?.tbd?.checkpointsByDaypart;
  const toggle = (dp, cp) => {
    const cur = map?.[dp] || CHECKPOINTS;
    const next = cur.includes(cp) ? cur.filter((c) => c !== cp) : CHECKPOINTS.filter((c) => cur.includes(c) || c === cp);
    save(() => store.update('settings', 'rules', { tbd: { ...data.settings.tbd, checkpointsByDaypart: { AM: map?.AM || CHECKPOINTS, PM: map?.PM || CHECKPOINTS, [dp]: next } } }), 'Saved');
  };
  return (
    <>
      {!map && <p className="small"><Tbd /> Using all four checkpoints in both dayparts until you decide.</p>}
      {['AM', 'PM'].map((dp) => (
        <div key={dp} className="row wrap" style={{ margin: '6px 0' }}>
          <b style={{ width: 36 }}>{dp}</b>
          {CHECKPOINTS.map((cp) => (
            <label key={cp} className="row small" style={{ fontWeight: 400, margin: 0 }}><input type="checkbox" checked={(map?.[dp] || CHECKPOINTS).includes(cp)} onChange={() => toggle(dp, cp)} /> {CHECKPOINT_LABEL[cp]}</label>
          ))}
        </div>
      ))}
    </>
  );
}

// ---------------- Pathways modules + quizzes ----------------
function PathwaysEditor() {
  const { data } = useApp();
  const save = useSave();
  const [pathway, setPathway] = useState('captain');
  const [edit, setEdit] = useState(null);
  const mods = data.modules.filter((m) => m.pathway === pathway).sort((a, b) => a.order - b.order);

  const submit = async () => {
    if (!edit.title.trim()) { toast('Title required'); return; }
    const bad = edit.questions.findIndex((q) => !q.prompt.trim() || q.choices.filter((c) => c.trim()).length < 2 || q.correctIndex == null || !q.choices[q.correctIndex]?.trim());
    if (bad >= 0) { toast(`Question ${bad + 1}: needs a prompt, 2+ choices, and the correct one picked`); return; }
    const doc = {
      pathway, title: edit.title.trim(), order: Number(edit.order) || 1, required: !!edit.required, content: edit.content,
      passPct: edit.passPct === '' || edit.passPct == null ? null : Number(edit.passPct),
      questions: edit.questions.map((q) => {
        const choices = q.choices.map((c) => c.trim()).filter(Boolean);
        return { prompt: q.prompt.trim(), choices, correctIndex: choices.indexOf(q.choices[q.correctIndex].trim()), explanation: q.explanation || '' };
      }),
    };
    const ok = await save(() => (edit.id ? store.update('modules', edit.id, doc) : store.add('modules', doc)), 'Module saved');
    if (ok) setEdit(null);
  };

  if (edit) {
    const setQ = (i, patch) => setEdit({ ...edit, questions: edit.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });
    return (
      <Card title={edit.id ? 'Edit module' : 'New module'}>
        <Field label="Title"><input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
        <div className="btns">
          <Field label="Order"><input inputMode="numeric" value={edit.order} onChange={(e) => setEdit({ ...edit, order: e.target.value })} /></Field>
          <Field label="Quiz pass % (blank = global)"><input inputMode="numeric" value={edit.passPct ?? ''} onChange={(e) => setEdit({ ...edit, passPct: e.target.value })} placeholder="TBD" /></Field>
        </div>
        <label className="row" style={{ fontWeight: 500 }}><input type="checkbox" checked={!!edit.required} onChange={(e) => setEdit({ ...edit, required: e.target.checked })} /> Required to complete the pathway</label>
        <Field label="Content" hint="Blank line = new paragraph. **bold**, [link](https://…), ![image](https://…) work."><textarea value={edit.content} onChange={(e) => setEdit({ ...edit, content: e.target.value })} style={{ minHeight: 180 }} /></Field>
        <h3>Quiz questions ({edit.questions.length})</h3>
        <p className="small muted">No questions = the module completes when they tap “I've finished this module”.</p>
        {edit.questions.map((q, i) => (
          <div key={i} className="card tight" style={{ background: '#fafaf9' }}>
            <Field label={`Question ${i + 1}`}><input value={q.prompt} onChange={(e) => setQ(i, { prompt: e.target.value })} /></Field>
            {q.choices.map((c, ci) => (
              <div key={ci} className="row" style={{ marginTop: 6 }}>
                <input type="radio" name={`correct-${i}`} checked={q.correctIndex === ci} onChange={() => setQ(i, { correctIndex: ci })} aria-label="Correct answer" style={{ width: 22, height: 22 }} />
                <input value={c} onChange={(e) => setQ(i, { choices: q.choices.map((x, xi) => (xi === ci ? e.target.value : x)) })} placeholder={`Choice ${ci + 1}`} />
              </div>
            ))}
            <div className="row">
              <button className="btn link small" onClick={() => setQ(i, { choices: [...q.choices, ''] })}>+ choice</button>
              <button className="btn link small" onClick={() => setEdit({ ...edit, questions: edit.questions.filter((_, j) => j !== i) })}>Remove question</button>
            </div>
            <Field label="Explanation (shown after)"><input value={q.explanation || ''} onChange={(e) => setQ(i, { explanation: e.target.value })} /></Field>
          </div>
        ))}
        <button className="btn secondary small" onClick={() => setEdit({ ...edit, questions: [...edit.questions, { prompt: '', choices: ['', '', ''], correctIndex: null, explanation: '' }] })}>+ Add question</button>
        <div className="btns" style={{ marginTop: 14 }}><button className="btn secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn" onClick={submit}>Save module</button></div>
      </Card>
    );
  }

  return (
    <>
      <Seg value={pathway} options={[['captain', 'Captain'], ['shift_leader', 'Shift Leader']]} onChange={setPathway} />
      <Card title={PATHWAY_LABEL[pathway]} right={<button className="btn small" onClick={() => setEdit({ title: '', order: (mods.at(-1)?.order || 0) + 1, required: true, content: '', passPct: '', questions: [] })}>Add module</button>}>
        {mods.map((m) => (
          <div key={m.id} className="list-link">
            <span>{m.order}. {m.title}<br /><span className="small muted">{m.required ? 'Required' : 'Optional'} · {m.questions?.length || 0} questions · pass {m.passPct ?? data.settings?.tbd?.quizPassPct ?? 'TBD'}{m.passPct == null && data.settings?.tbd?.quizPassPct != null ? '% (global)' : m.passPct != null ? '%' : ''}</span></span>
            <span className="row">
              <button className="btn link small" onClick={() => setEdit({ ...m, questions: (m.questions || []).map((q) => ({ ...q })) })}>Edit</button>
              <button className="btn link small" onClick={() => confirm(`Delete "${m.title}"?`) && save(() => store.remove('modules', m.id), 'Deleted')}>✕</button>
            </span>
          </div>
        ))}
      </Card>
    </>
  );
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
      <Card title="Pathways & shifts">
        <Field label="Quiz pass % (used when a module doesn't set its own)"><input inputMode="numeric" value={t.quizPassPct ?? ''} placeholder="TBD" onChange={(e) => set((d) => { d.tbd.quizPassPct = num(e.target.value); })} />{tbdNote(t.quizPassPct)}</Field>
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
  const cols = ['people', 'areas', 'attendance', 'letters', 'applications', 'p5Evals', 'shifts', 'progress', 'roleHistory', 'coaching', 'checklistItems', 'checklistRuns', 'summaries', 'modules', 'p5Items', 'members'];
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
      <p className="small muted">Attendance export covers the last 180 days. Checklist runs cover the last 14 days.{demoMode ? ' (Demo data)' : ''}</p>
    </Card>
  );
}
