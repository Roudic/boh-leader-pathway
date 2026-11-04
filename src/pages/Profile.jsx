import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../data/AppContext.jsx';
import { store } from '../data/store.js';
import { can } from '../lib/access.js';
import {
  attendanceStats, pipelineStatus, prereqChecklist, shiftSummary, statusFromTimes, daysInRoles, ROLE_KEY,
} from '../lib/rules.js';
import { fmtPct } from '../lib/p5.js';
import { addDays, daysBetween, fmtDate, nowIso } from '../lib/dates.js';
import { ATTENDANCE_LABEL, ATTENDANCE_STATUSES, LETTER_AUTHOR_ROLES, NOTE_TYPES, STATUS_LABEL, TARGET_ROLES, PERSON_ROLES } from '../lib/constants.js';
import { Card, Field, Pill, Seg, Tbd, toast } from '../components/ui.jsx';
import { statusTone } from './Dashboard.jsx';

function Disclose({ label, children, small = true }) {
  const [open, setOpen] = useState(false);
  return open ? (
    <div className="card tight" style={{ background: '#fafaf9' }}>
      {children(() => setOpen(false))}
      <button className="btn link" onClick={() => setOpen(false)}>Cancel</button>
    </div>
  ) : (
    <button className={`btn secondary ${small ? 'small' : ''}`} onClick={() => setOpen(true)}>{label}</button>
  );
}

function useSave() {
  const { reload } = useApp();
  return async (fn, msg) => {
    try { await fn(); await reload(); if (msg) toast(msg); return true; } catch (e) { toast(`Couldn't save: ${e.message}`); return false; }
  };
}

export default function Profile() {
  const { id } = useParams();
  const { data, member } = useApp();
  const save = useSave();
  const p = data.people.find((x) => x.id === id);
  if (!p) return <p style={{ marginTop: 20 }}>Person not found.</p>;
  if (!can.seeAll(member) && member.personId !== id) return <p style={{ marginTop: 20 }}>You can only see your own profile.</p>;

  const admin = can.admin(member);
  const evaluator = can.evaluate(member);
  const isMe = member.personId === id;
  const area = data.areas.find((a) => a.id === p.areaId);
  const status = pipelineStatus(p, data);
  const check = prereqChecklist(p, data);
  const att = attendanceStats(data.attendance.filter((a) => a.personId === id), data.settings, data.today);
  const evals = data.p5Evals.filter((e) => e.personId === id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const letters = data.letters.filter((l) => l.personId === id);
  const apps = data.applications.filter((a) => a.personId === id);
  const notes = data.coaching.filter((n) => n.personId === id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const history = data.roleHistory.filter((h) => h.personId === id);
  const shifts = p.pipelineTarget ? shiftSummary(p, data) : null;
  const curHist = history.find((h) => !h.endDate && h.role === p.currentRole);
  const daysInRole = p.roleStartDate ? daysBetween(p.roleStartDate, data.today) : curHist?.startDate ? daysBetween(curHist.startDate, data.today) : null;
  const p5Eligible = (data.settings?.p5?.applies_to || []).includes(p.currentRole);
  const name = (pid) => data.people.find((x) => x.id === pid)?.name || '—';

  return (
    <>
      <div style={{ marginTop: 12 }}>
        <h1 style={{ marginBottom: 2 }}>{p.name}</h1>
        <div className="muted">{p.currentRole}{area ? ` · ${area.name}` : ''} · {p.daypart || (p.areaId ? <Tbd>daypart TBD</Tbd> : 'All')}</div>
        <div className="row wrap" style={{ marginTop: 6 }}>
          {p.pipelineTarget && <Pill>→ {p.pipelineTarget}</Pill>}
          {status.status !== 'none' && <Pill tone={statusTone(status.status)}>{STATUS_LABEL[status.status]}{status.overridden ? ' (set by Joshua)' : ''}</Pill>}
          {p.isCertifiedTrainer && <Pill>Certified trainer</Pill>}
          {p.isManager && <Pill>Manager</Pill>}
        </div>
        <p className="small muted">Days in current role: {daysInRole != null ? daysInRole : 'start date not set'}{p.notes ? ` · ${p.notes}` : ''}</p>
        {p.currentRole === 'Area Captain' && <p className="small muted">Area Captain raise: <Tbd /></p>}
        {status.dropped && <p className="small" style={{ color: 'var(--bad)' }}>⚠ A prerequisite dropped after shifts or approval started.</p>}
      </div>

      {p.pipelineTarget && (
        <Card title={`${p.pipelineTarget} prerequisites`} right={check && !check.tbd && <span className="small">{check.met}/{check.total}</span>}>
          {check.tbd ? (
            <p><Tbd>TBD</Tbd> {p.pipelineTarget} prerequisites aren't defined yet. Joshua can add them later.</p>
          ) : check.items.map((i) => (
            <div className="check" key={i.id}>
              <span className={`mark ${i.met ? 'ok' : 'bad'}`}>{i.met ? '✓' : '✗'}</span>
              <div className="grow">
                <div><b>{i.label}</b></div>
                <div className="small muted">{i.current} · needs {i.required}{i.note ? ` · ${i.note}` : ''}</div>
                {admin && (i.overridden ? (
                  <button className="btn link small" onClick={() => confirm(`Uncheck "${i.label}" for ${p.name}?`) && save(() => store.update('people', id, { prereqOverrides: Object.fromEntries(Object.entries(p.prereqOverrides || {}).filter(([k]) => k !== i.id)), ...(i.type === 'pathway_complete' ? { pathwayComplete: Object.fromEntries(Object.entries(p.pathwayComplete || {}).filter(([k]) => k !== i.pathway)) } : {}) }), 'Unchecked')}>Uncheck</button>
                ) : !i.met && (
                  <OverrideForm onSave={(note) => save(() => store.update('people', id, { prereqOverrides: { ...(p.prereqOverrides || {}), [i.id]: { note, by: member.personId, at: nowIso() } } }), 'Marked met')} />
                ))}
              </div>
            </div>
          ))}
          {isMe && p.pipelineTarget !== 'Shift Leader' && !apps.some((a) => a.targetRole === p.pipelineTarget) && (
            <Link className="btn" style={{ marginTop: 10 }} to="/apply">Submit application of interest</Link>
          )}
        </Card>
      )}

      {shifts && (
        <ShiftsCard p={p} shifts={shifts} check={check} canScore={can.scoreShifts(member)} save={save} member={member} name={name} />
      )}

      <Card title="Attendance (60 days)" right={<b>{att.pct == null ? '—' : fmtPct(att.pct, 1)}</b>}>
        <p className="small muted" style={{ marginTop: 0 }}>{att.onTime} on time of {att.counted} counted shifts. On time = {data.settings?.tbd?.onTimeGraceMinutes != null ? `within ${data.settings.tbd.onTimeGraceMinutes} min` : <><Tbd /> (using: at or before start)</>} · Excused: {data.settings?.tbd?.excusedHandling ? data.settings.tbd.excusedHandling.replace(/_/g, ' ') : <><Tbd /> (using: not counted)</>}</p>
        <AttendanceTrend records={data.attendance.filter((a) => a.personId === id)} settings={data.settings} today={data.today} />
        {admin && <AttendanceForm personId={id} save={save} settings={data.settings} today={data.today} />}
        {admin && <RecentAttendance records={data.attendance.filter((a) => a.personId === id)} save={save} />}
      </Card>

      {(p5Eligible || evals.length > 0) && (
        <Card title="P5 Evaluations" right={evaluator && p5Eligible && <Link className="btn small" to={`/p5/new?person=${id}`}>New P5</Link>}>
          {evals.length === 0 && <p className="muted">No P5 yet.</p>}
          {evals[0] && <P5Bars e={evals[0]} />}
          {evals.map((e) => (
            <Link key={e.id} to={`/p5/${e.id}`} className="list-link">
              <span>{fmtDate(e.date)} · {e.total}/80 ({fmtPct(e.percent)}){e.coachingFlags?.length ? <span className="small" style={{ color: 'var(--bad)' }}> · focus {e.coachingFlags.join(', ')}</span> : ''}</span>
              <Pill tone={e.passed ? 'ok' : 'bad'}>{e.passed ? 'Pass' : 'Not yet'}</Pill>
            </Link>
          ))}
          <p className="small muted">Which P5 counts for the prerequisite: {data.settings?.tbd?.p5Counts || <><Tbd /> (using latest)</>}</p>
        </Card>
      )}

      <Card title="Recommendation letters" right={<span className="small">{letters.length}</span>}>
        {letters.map((l) => (
          <div key={l.id} className="check">
            <span className="mark">✉</span>
            <div className="grow"><b>{l.authorName}</b> <span className="small muted">({l.authorRole}) · {fmtDate(l.dateReceived)} · for {l.targetRole}</span>{l.text && <div className="small">{l.text}</div>}{admin && <div><button className="btn link small" onClick={() => confirm(`Remove the letter from ${l.authorName}?`) && save(() => store.remove('letters', l.id), 'Letter removed')}>Remove</button></div>}</div>
          </div>
        ))}
        {letters.length === 0 && <p className="muted">None yet.</p>}
        {admin && <Disclose label="Log a letter">{(close) => <LetterForm p={p} people={data.people} onSave={async (doc) => { if (await save(() => store.add('letters', { ...doc, personId: id, loggedBy: member.personId }), 'Letter logged')) close(); }} />}</Disclose>}
      </Card>

      <Card title="Application of interest">
        {apps.map((a) => (
          <div key={a.id} className="small" style={{ marginBottom: 8 }}>
            <b>{a.targetRole}</b> · {fmtDate(a.submittedAt)} · {a.source === 'paper' ? 'paper' : 'in app'} · {a.status}
            {a.why && <div>“{a.why}”</div>}
            {admin && (
              <div>
                <button className="btn link small" onClick={() => save(() => store.update('applications', a.id, { status: a.status === 'reviewed' ? 'submitted' : 'reviewed' }), a.status === 'reviewed' ? 'Marked not reviewed' : 'Marked reviewed')}>{a.status === 'reviewed' ? 'Uncheck reviewed' : 'Mark reviewed'}</button>
                <button className="btn link small" onClick={() => confirm(`Remove this ${a.targetRole} application?`) && save(() => store.remove('applications', a.id), 'Application removed')}>Remove</button>
              </div>
            )}
          </div>
        ))}
        {apps.length === 0 && <p className="muted">None yet.</p>}
        {admin && <Disclose label="Log a paper application">{(close) => (
          <PaperAppForm defaultRole={p.pipelineTarget} onSave={async (doc) => { if (await save(() => store.add('applications', { ...doc, personId: id, status: 'submitted', source: 'paper' }), 'Application logged')) close(); }} />
        )}</Disclose>}
      </Card>

      {(evaluator || notes.length > 0) && (
        <Card title="Coaching notes">
          {notes.map((n) => (
            <div key={n.id} className="check">
              <span className="mark">{n.type === 'praise' ? '👏' : n.type === 'follow-up' ? '📌' : '💬'}</span>
              <div className="grow">
                <div className="small muted">{fmtDate(n.date)} · {name(n.authorId)}{n.linkedP ? ` · ${n.linkedP}` : ''}{n.followUpDate ? ` · follow up ${fmtDate(n.followUpDate)}` : ''}{evaluator ? (n.shared ? ' · shared with them' : ' · private') : ''}</div>
                <div>{n.text}</div>
                {evaluator && !n.resolved && n.followUpDate && <button className="btn link small" onClick={() => save(() => store.update('coaching', n.id, { resolved: true }), 'Resolved')}>Mark resolved</button>}
                {n.resolved && <span className="small muted">Resolved</span>}
                {admin && n.resolved && <button className="btn link small" onClick={() => save(() => store.update('coaching', n.id, { resolved: false }), 'Reopened')}>Uncheck resolved</button>}
                {admin && <button className="btn link small" onClick={() => confirm('Delete this coaching note?') && save(() => store.remove('coaching', n.id), 'Note deleted')}>Delete</button>}
              </div>
            </div>
          ))}
          {notes.length === 0 && <p className="muted">None yet.</p>}
          {evaluator && <Disclose label="Add coaching note">{(close) => <CoachingForm onSave={async (doc) => { if (await save(() => store.add('coaching', { ...doc, personId: id, authorId: member.personId, resolved: false }), 'Note added')) close(); }} today={data.today} />}</Disclose>}
        </Card>
      )}

      <Card title="Role history">
        {history.map((h) => (
          <div key={h.id} className="small" style={{ marginBottom: 4 }}>{h.role}{h.areaId ? ` · ${data.areas.find((a) => a.id === h.areaId)?.name}` : ''} · {h.startDate ? fmtDate(h.startDate) : 'start ?'} → {h.endDate ? fmtDate(h.endDate) : 'now'}{h.reason ? ` · ${h.reason}` : ''}</div>
        ))}
        {admin && <RoleHistoryForm p={p} history={history} save={save} />}
        <p className="small muted">Assistant Captain days count toward “60 days as Captain”: {data.settings?.tbd?.assistantDaysCount == null ? <><Tbd /> (using: no)</> : data.settings.tbd.assistantDaysCount ? 'yes' : 'no'} · Area Captain days: {daysInRoles(id, ['Area Captain'], data.roleHistory, data.today)}</p>
      </Card>

      {admin && <AdminActions p={p} status={status} save={save} member={member} areas={data.areas} history={history} today={data.today} />}
    </>
  );
}

function OverrideForm({ onSave }) {
  return (
    <Disclose label="Mark met outside the app">{(close) => (
      <NoteForm label="Why / proof (required)" onSave={async (note) => { await onSave(note); close(); }} />
    )}</Disclose>
  );
}

function NoteForm({ label, onSave }) {
  const [note, setNote] = useState('');
  return (
    <>
      <Field label={label}><textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <button className="btn small" style={{ marginTop: 8 }} onClick={() => (note.trim() ? onSave(note.trim()) : toast('A note is required'))}>Save</button>
    </>
  );
}

function P5Bars({ e }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div className="small muted">Latest by P</div>
      {[1, 2, 3, 4, 5].map((n) => {
        const k = `P${n}`;
        const s = e.pScores?.[k] ?? 0;
        return (
          <div key={k} className="row small" style={{ marginTop: 4 }}>
            <span style={{ width: 24 }}>{k}</span>
            <div className="grow"><div className="bar"><div style={{ width: `${(s / 16) * 100}%`, background: e.coachingFlags?.includes(k) ? 'var(--bad)' : 'var(--ok)' }} /></div></div>
            <span style={{ width: 40 }} className="right">{s}/16</span>
          </div>
        );
      })}
    </div>
  );
}

function AttendanceTrend({ records, settings, today }) {
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const end = addDays(today, -7 * (7 - i));
    const recs = records.filter((r) => { const d = daysBetween(r.date, end); return d >= 0 && d < 7; });
    const s = attendanceStats(recs, { ...settings, attendance: { window_days: 10000 } }, end);
    return { end, pct: s.pct, n: s.counted };
  });
  if (!records.length) return <p className="muted small">No shifts entered yet.</p>;
  return (
    <div className="row" style={{ alignItems: 'flex-end', height: 60, gap: 4, margin: '8px 0' }} aria-label="Weekly on-time trend, last 8 weeks">
      {weeks.map((w) => (
        <div key={w.end} className="grow" title={`Week ending ${fmtDate(w.end)}: ${w.pct == null ? 'no shifts' : fmtPct(w.pct, 0)}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
          <div style={{ width: '100%', height: `${w.pct == null ? 3 : Math.max(4, w.pct * 0.5)}px`, background: w.pct == null ? '#ddd' : w.pct >= 95 ? 'var(--ok)' : w.pct >= 90 ? '#d9a400' : 'var(--bad)', borderRadius: 3 }} />
          <span style={{ fontSize: '.6rem' }} className="muted">{fmtDate(w.end).slice(0, -3)}</span>
        </div>
      ))}
    </div>
  );
}

function AttendanceForm({ personId, save, settings, today }) {
  const [f, setF] = useState({ date: today, scheduledStart: '', actualClockIn: '', status: 'on_time' });
  const auto = statusFromTimes(f.scheduledStart, f.actualClockIn, settings);
  const status = auto && f.status !== 'absent' && f.status !== 'excused' ? auto : f.status;
  return (
    <Disclose label="Add shift">{(close) => (
      <>
        <Field label="Date"><input type="date" value={f.date} max={today} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <div className="btns">
          <Field label="Scheduled"><input type="time" value={f.scheduledStart} onChange={(e) => setF({ ...f, scheduledStart: e.target.value })} /></Field>
          <Field label="Clocked in"><input type="time" value={f.actualClockIn} onChange={(e) => setF({ ...f, actualClockIn: e.target.value })} /></Field>
        </div>
        <Field label="Result" hint={auto ? `From the times: ${ATTENDANCE_LABEL[auto]}` : ''}>
          <Seg value={status} options={ATTENDANCE_STATUSES.map((s) => [s, ATTENDANCE_LABEL[s]])} onChange={(v) => setF({ ...f, status: v })} />
        </Field>
        <button className="btn small" style={{ marginTop: 8 }} onClick={async () => { if (await save(() => store.add('attendance', { ...f, status, personId, source: 'manual' }), 'Shift added')) close(); }}>Save</button>
      </>
    )}</Disclose>
  );
}

function RecentAttendance({ records, save }) {
  const recent = [...records].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  if (!recent.length) return null;
  return (
    <table className="simple" style={{ marginTop: 8 }}>
      <tbody>{recent.map((r) => (
        <tr key={r.id}><td>{fmtDate(r.date)}</td><td>{ATTENDANCE_LABEL[r.status]}</td><td className="muted">{r.scheduledStart && `${r.scheduledStart}→${r.actualClockIn || '?'}`}</td>
          <td className="right"><button className="btn link small" onClick={() => confirm('Delete this shift?') && save(() => store.remove('attendance', r.id), 'Deleted')}>✕</button></td></tr>
      ))}</tbody>
    </table>
  );
}

function LetterForm({ p, people, onSave }) {
  const authors = people.filter((x) => x.id !== p.id && (['Admin', 'Manager', 'Shift Leader'].includes(x.currentRole) || x.isManager));
  const [f, setF] = useState({ authorPersonId: '', authorName: '', authorRole: 'Manager', targetRole: p.pipelineTarget || 'Area Captain', dateReceived: new Date().toISOString().slice(0, 10), text: '' });
  const pickAuthor = (pid) => {
    const a = people.find((x) => x.id === pid);
    const role = a ? (a.isManager ? 'Manager' : a.pipelineTarget === 'Shift Leader' ? 'Shift Leader in Training' : a.currentRole === 'Shift Leader' ? 'Shift Leader' : 'Other') : f.authorRole;
    setF({ ...f, authorPersonId: pid, authorName: a?.name || '', authorRole: role });
  };
  return (
    <>
      <Field label="From (team)"><select value={f.authorPersonId} onChange={(e) => pickAuthor(e.target.value)}><option value="">Someone else…</option>{authors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
      {!f.authorPersonId && <Field label="Author name"><input value={f.authorName} onChange={(e) => setF({ ...f, authorName: e.target.value })} /></Field>}
      <Field label="Author role"><select value={f.authorRole} onChange={(e) => setF({ ...f, authorRole: e.target.value })}>{LETTER_AUTHOR_ROLES.map((r) => <option key={r}>{r}</option>)}</select></Field>
      <Field label="For role"><select value={f.targetRole} onChange={(e) => setF({ ...f, targetRole: e.target.value })}>{TARGET_ROLES.map((r) => <option key={r}>{r}</option>)}</select></Field>
      <Field label="Date received"><input type="date" value={f.dateReceived} onChange={(e) => setF({ ...f, dateReceived: e.target.value })} /></Field>
      <Field label="Letter text or where it's filed (optional)"><textarea value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} /></Field>
      <button className="btn small" style={{ marginTop: 8 }} onClick={() => (f.authorName.trim() ? onSave({ ...f, authorPersonId: f.authorPersonId || null }) : toast('Who wrote it?'))}>Save</button>
    </>
  );
}

function PaperAppForm({ defaultRole, onSave }) {
  const [f, setF] = useState({ targetRole: defaultRole || 'Area Captain', why: '', submittedAt: new Date().toISOString().slice(0, 10) });
  return (
    <>
      <Field label="Role"><select value={f.targetRole} onChange={(e) => setF({ ...f, targetRole: e.target.value })}>{TARGET_ROLES.map((r) => <option key={r}>{r}</option>)}</select></Field>
      <Field label="Date"><input type="date" value={f.submittedAt} onChange={(e) => setF({ ...f, submittedAt: e.target.value })} /></Field>
      <Field label="Notes"><textarea value={f.why} onChange={(e) => setF({ ...f, why: e.target.value })} /></Field>
      <button className="btn small" style={{ marginTop: 8 }} onClick={() => onSave(f)}>Save</button>
    </>
  );
}

function CoachingForm({ onSave, today }) {
  const [f, setF] = useState({ type: 'coaching', linkedP: '', text: '', followUpDate: '', shared: false, date: today });
  return (
    <>
      <Field label="Type"><Seg value={f.type} options={NOTE_TYPES} onChange={(v) => setF({ ...f, type: v })} /></Field>
      <Field label="P (optional)"><Seg value={f.linkedP} options={[['', '—'], 'P1', 'P2', 'P3', 'P4', 'P5']} onChange={(v) => setF({ ...f, linkedP: v })} /></Field>
      <Field label="Note"><textarea value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} /></Field>
      <Field label="Follow-up date (optional)"><input type="date" value={f.followUpDate} onChange={(e) => setF({ ...f, followUpDate: e.target.value })} /></Field>
      <label className="row" style={{ fontWeight: 500 }}><input type="checkbox" checked={f.shared} onChange={(e) => setF({ ...f, shared: e.target.checked })} /> Let them see this note</label>
      <button className="btn small" style={{ marginTop: 8 }} onClick={() => (f.text.trim() ? onSave({ ...f, followUpDate: f.followUpDate || null, linkedP: f.linkedP || null }) : toast('Write the note'))}>Save</button>
    </>
  );
}

function ShiftsCard({ p, shifts, check, canScore, save, member, name }) {
  const { cfg, kind } = shifts;
  const blocked = !check?.allMet;
  const [f, setF] = useState({ date: new Date().toISOString().slice(0, 10), pointsEarned: '', pointsPossible: '', notes: '', overrideNote: '' });
  const next = Array.from({ length: cfg.count }, (_, i) => i + 1).find((n) => !shifts.shifts.some((s) => s.shiftNumber === n)) ?? cfg.count + 1;
  const ruleText = cfg.pass_pct != null ? `Pass: total ≥ ${cfg.pass_pct}%` : 'Pass rule: TBD (Joshua decides)';
  return (
    <Card title={kind === 'training' ? 'Training shifts' : 'Evaluation shifts'} right={<span className="small">{shifts.shifts.length}/{cfg.count}</span>}>
      <p className="small muted" style={{ marginTop: 0 }}>{cfg.label}. {ruleText}. Score sheet: <Tbd /></p>
      {shifts.shifts.map((s) => (
        <div key={s.id} className="row between small" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
          <span>#{s.shiftNumber} · {fmtDate(s.date)} · {name(s.managerId)}{s.notes ? ` · ${s.notes}` : ''}</span>
          <span className="row">
            <b>{s.pointsEarned}/{s.pointsPossible}</b>
            {member.role === 'admin' && <button className="btn link small" aria-label={`Remove shift ${s.shiftNumber}`} onClick={() => confirm(`Remove the score for shift #${s.shiftNumber}?`) && save(() => store.remove('shifts', s.id), 'Shift removed')}>✕</button>}
          </span>
        </div>
      ))}
      {shifts.shifts.length > 0 && (
        <p><b>Total: {shifts.earned}/{shifts.possible} ({shifts.pct == null ? '—' : fmtPct(shifts.pct)})</b> {shifts.passed === true && <Pill tone="ok">Pass</Pill>}{shifts.passed === false && <Pill tone="bad">Below {cfg.pass_pct}%</Pill>}</p>
      )}
      {canScore && next <= cfg.count && (
        <Disclose label={`Score shift #${next}`}>{(close) => (
          <>
            {blocked && <p className="small" style={{ color: 'var(--bad)' }}>Prerequisites aren't all met. Admin override note required to score.</p>}
            <Field label="Date"><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            <div className="btns">
              <Field label="Points earned"><input inputMode="decimal" value={f.pointsEarned} onChange={(e) => setF({ ...f, pointsEarned: e.target.value })} /></Field>
              <Field label="Points possible"><input inputMode="decimal" value={f.pointsPossible} onChange={(e) => setF({ ...f, pointsPossible: e.target.value })} /></Field>
            </div>
            <Field label="Notes"><textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
            {blocked && <Field label="Override note (admin only)"><textarea value={f.overrideNote} onChange={(e) => setF({ ...f, overrideNote: e.target.value })} /></Field>}
            <button className="btn small" style={{ marginTop: 8 }} onClick={async () => {
              const earned = Number(f.pointsEarned); const possible = Number(f.pointsPossible);
              if (!(possible > 0) || !(earned >= 0) || earned > possible) { toast('Check the points'); return; }
              if (blocked && (member.role !== 'admin' || !f.overrideNote.trim())) { toast('Blocked until prerequisites are met (admin override with note)'); return; }
              if (await save(() => store.add('shifts', { personId: p.id, kind, shiftNumber: next, date: f.date, managerId: member.personId, pointsEarned: earned, pointsPossible: possible, notes: f.notes, overrideNote: blocked ? f.overrideNote : null }), 'Shift scored')) close();
            }}>Save</button>
          </>
        )}</Disclose>
      )}
      {!canScore && shifts.shifts.length < cfg.count && <p className="small muted">Only Managers can score these shifts.</p>}
    </Card>
  );
}

function RoleHistoryForm({ p, history, save }) {
  return (
    <Disclose label="Set role start date">{(close) => <StartDateForm onSave={async (date) => {
      const cur = history.find((h) => !h.endDate && h.role === p.currentRole);
      const ok = await save(async () => {
        if (cur) await store.update('roleHistory', cur.id, { startDate: date });
        else await store.add('roleHistory', { personId: p.id, role: p.currentRole, areaId: p.areaId || null, daypart: p.daypart || null, startDate: date, endDate: null, reason: 'Entered by admin' });
        await store.update('people', p.id, { roleStartDate: date });
      }, 'Start date saved');
      if (ok) close();
    }} />}</Disclose>
  );
}

function StartDateForm({ onSave }) {
  const [d, setD] = useState('');
  return (
    <>
      <Field label="Started current role on"><input type="date" value={d} onChange={(e) => setD(e.target.value)} /></Field>
      <button className="btn small" style={{ marginTop: 8 }} onClick={() => (d ? onSave(d) : toast('Pick a date'))}>Save</button>
    </>
  );
}

function AdminActions({ p, status, save, member, areas, history, today }) {
  const [promo, setPromo] = useState({ role: p.pipelineTarget || 'Area Captain', areaId: p.areaId || '', daypart: p.daypart || '', reason: '' });
  const [ovr, setOvr] = useState({ status: '', note: '' });
  const isAC = ROLE_KEY[p.pipelineTarget] === 'area_captain';
  return (
    <Card title="Joshua only">
      {isAC && status.status === 'eval_shifts_complete' && !p.approvedForPromotion && (
        <button className="btn ok" style={{ marginBottom: 8 }} onClick={() => save(() => store.update('people', p.id, { approvedForPromotion: { by: member.personId, at: nowIso() } }), 'Approved')}>Approve for Area Captain (after 3 evaluation shifts)</button>
      )}
      {p.approvedForPromotion && (
        <button className="btn secondary" style={{ marginBottom: 8 }} onClick={() => confirm(`Uncheck ${p.name}'s approval?`) && save(() => store.update('people', p.id, { approvedForPromotion: null }), 'Approval removed')}>Uncheck approval for Area Captain</button>
      )}
      <div className="stack">
        <Disclose label="Promote…" small={false}>{(close) => (
          <>
            <p className="small muted">The app never promotes on its own. This ends their current role and starts the new one today.</p>
            <Field label="New role"><select value={promo.role} onChange={(e) => setPromo({ ...promo, role: e.target.value })}>{PERSON_ROLES.filter((r) => r !== 'Admin').map((r) => <option key={r}>{r}</option>)}</select></Field>
            <Field label="Area"><select value={promo.areaId} onChange={(e) => setPromo({ ...promo, areaId: e.target.value })}><option value="">All / none</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
            <Field label="Daypart"><Seg value={promo.daypart} options={[['', 'TBD'], 'AM', 'PM']} onChange={(v) => setPromo({ ...promo, daypart: v })} /></Field>
            <Field label="Note"><input value={promo.reason} onChange={(e) => setPromo({ ...promo, reason: e.target.value })} /></Field>
            <button className="btn small" style={{ marginTop: 8 }} onClick={async () => {
              if (!confirm(`Promote ${p.name} to ${promo.role}?`)) return;
              const ok = await save(async () => {
                for (const h of history.filter((x) => !x.endDate)) await store.update('roleHistory', h.id, { endDate: today });
                await store.add('roleHistory', { personId: p.id, role: promo.role, areaId: promo.areaId || null, daypart: promo.daypart || null, startDate: today, endDate: null, reason: promo.reason || 'Promoted' });
                await store.update('people', p.id, { currentRole: promo.role, areaId: promo.areaId || null, daypart: promo.daypart || null, roleStartDate: today, pipelineTarget: null, approvedForPromotion: null, statusOverride: null, statusLabel: promo.role });
                const area = areas.find((a) => a.id === promo.areaId);
                if (area && promo.role === 'Assistant Captain' && promo.daypart) await store.update('areas', area.id, { assistantDaypart: promo.daypart });
              }, `${p.name} promoted`);
              if (ok) close();
            }}>Confirm promotion</button>
          </>
        )}</Disclose>
        <Disclose label={p.statusOverride ? `Status set by you: ${STATUS_LABEL[p.statusOverride.status]}` : 'Override pipeline status…'} small={false}>{(close) => (
          <>
            <Field label="Status"><select value={ovr.status} onChange={(e) => setOvr({ ...ovr, status: e.target.value })}><option value="">Automatic (computed)</option>{Object.entries(STATUS_LABEL).filter(([k]) => k !== 'none').map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Note"><input value={ovr.note} onChange={(e) => setOvr({ ...ovr, note: e.target.value })} /></Field>
            <button className="btn small" style={{ marginTop: 8 }} onClick={async () => {
              if (ovr.status && !ovr.note.trim()) { toast('A note is required'); return; }
              if (await save(() => store.update('people', p.id, { statusOverride: ovr.status ? { ...ovr, by: member.personId, at: nowIso() } : null }), 'Status saved')) close();
            }}>Save</button>
          </>
        )}</Disclose>
      </div>
    </Card>
  );
}
