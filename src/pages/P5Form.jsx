import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../data/AppContext.jsx';
import { store } from '../data/store.js';
import { scoreP5, p5Config, fmtPct } from '../lib/p5.js';
import { nowIso } from '../lib/dates.js';
import { Card, Field, Pill, Seg, toast } from '../components/ui.jsx';

export default function P5Form() {
  const { data, member, reload } = useApp();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const cfg = p5Config(data.settings);
  const appliesTo = data.settings?.p5?.applies_to || ['Area Captain', 'Assistant Captain'];
  const eligible = data.people.filter((p) => p.active !== false && appliesTo.includes(p.currentRole));
  const shiftLeaders = data.people.filter((p) => p.active !== false && p.currentRole === 'Shift Leader');

  const [personId, setPersonId] = useState(params.get('person') || '');
  const person = eligible.find((p) => p.id === personId);
  const [areaId, setAreaId] = useState(person?.areaId || '');
  const [daypart, setDaypart] = useState(new Date().getHours() < 15 ? 'AM' : 'PM');
  const [date, setDate] = useState(data.today);
  const [slId, setSlId] = useState(shiftLeaders.some((s) => s.id === member.personId) ? member.personId : '');
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState({});
  const [strengths, setStrengths] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [modAck, setModAck] = useState(false);
  const [tmAck, setTmAck] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);

  const result = useMemo(() => scoreP5(data.p5Items, scores, data.settings), [scores, data]);
  const missingNotes = result.ps.filter((p) => p.needsNote && !notes[`P${p.p}`]?.trim());

  const pick = (id) => {
    setPersonId(id);
    const p = eligible.find((x) => x.id === id);
    if (p) { setAreaId(p.areaId || ''); if (p.daypart) setDaypart(p.daypart); }
  };

  const problems = [];
  if (!person) problems.push('Pick who you are evaluating');
  if (!areaId) problems.push('Pick the area');
  if (!result.complete) problems.push(`Score all ${data.p5Items.length} behaviors (${result.scored} done)`);
  if (missingNotes.length) problems.push(`Write an example for ${missingNotes.map((p) => `P${p.p}`).join(', ')} (has a 1 or 2)`);
  if (!modAck) problems.push('MOD acknowledge');

  const submit = async () => {
    setTried(true);
    if (problems.length) { toast(problems[0]); return; }
    setSaving(true);
    try {
      const id = await store.add('p5Evals', {
        personId, roleAtTime: person.currentRole, areaId, daypart, date,
        evaluatorId: member.personId, shiftLeaderId: slId || null,
        scores, notes, strengths, coachingNextStep: nextStep, followUpDate: followUp || null,
        pScores: Object.fromEntries(result.ps.map((p) => [`P${p.p}`, p.score])),
        pAverages: Object.fromEntries(result.ps.map((p) => [`P${p.p}`, p.avg])),
        total: result.total, percent: result.percent, passed: result.passed, coachingFlags: result.coachingFlags,
        modSignedAt: nowIso(), teamMemberSignedAt: tmAck ? nowIso() : null,
      });
      await reload();
      toast('P5 saved');
      nav(`/p5/${id}`, { replace: true });
    } catch (e) {
      toast(`Couldn't save: ${e.message}`);
      setSaving(false);
    }
  };

  const groups = [1, 2, 3, 4, 5].map((p) => ({ p, items: data.p5Items.filter((i) => i.pIndex === p) }));

  return (
    <>
      <h1 style={{ marginTop: 12 }}>P5 Evaluation</h1>
      <Card tight>
        <Field label="Who are you evaluating?">
          <select value={personId} onChange={(e) => pick(e.target.value)}>
            <option value="">Pick a Captain / Assistant Captain…</option>
            {eligible.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.currentRole})</option>)}
          </select>
        </Field>
        <Field label="Area">
          <Seg value={areaId} options={data.areas.map((a) => [a.id, a.name])} onChange={setAreaId} />
        </Field>
        <div className="btns">
          <Field label="Daypart"><Seg value={daypart} options={['AM', 'PM']} onChange={setDaypart} /></Field>
          <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <Field label="Shift Leader on shift">
          <select value={slId} onChange={(e) => setSlId(e.target.value)}>
            <option value="">—</option>
            {shiftLeaders.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <p className="small muted" style={{ marginBottom: 0 }}>Score only what you saw this shift. {Object.entries(cfg.scale).map(([k, v]) => `${k} = ${v}`).join(' · ')}</p>
      </Card>

      <div className="p5-sticky">
        <div className="p5-total">
          <span>{result.scored}/{data.p5Items.length} scored</span>
          <span className="big">{result.total}/{result.max} · {fmtPct(result.percent)}</span>
          {result.complete ? <Pill tone={result.passed ? 'ok' : 'bad'}>{result.passed ? 'Pass' : 'Not yet'}</Pill> : <Pill>…</Pill>}
        </div>
      </div>

      {groups.map(({ p, items }) => {
        const ps = result.ps[p - 1];
        const noteKey = `P${p}`;
        return (
          <Card key={p} tight>
            <div className="p-head">
              <h2 style={{ margin: 0 }}>{items[0]?.pArea}</h2>
              <span className={ps.coaching ? 'pill bad' : 'pill'}>{ps.score}/{ps.max}</span>
            </div>
            {items.map((it) => (
              <div className="behavior" key={it.id}>
                <div className="txt"><b>{it.id}</b> {it.behavior}</div>
                <div className="scale" role="radiogroup" aria-label={`Score for ${it.id}`}>
                  {[1, 2, 3, 4].map((v) => (
                    <button key={v} type="button" role="radio" aria-checked={scores[it.id] === v}
                      className={`${scores[it.id] === v ? 'on' : ''} ${v <= 2 ? 'low' : ''}`}
                      onClick={() => setScores((s) => ({ ...s, [it.id]: v }))}>
                      {v}<small>{cfg.scale[v]}</small>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <Field label={ps.needsNote ? `${noteKey} example (required: a 1 or 2 was scored)` : `${noteKey} notes (optional)`}
              error={tried && ps.needsNote && !notes[noteKey]?.trim() ? 'Write what you saw, when, and where.' : ''}>
              <textarea value={notes[noteKey] || ''} onChange={(e) => setNotes((n) => ({ ...n, [noteKey]: e.target.value }))}
                placeholder={ps.needsNote ? 'What did you see, when, where?' : ''} style={{ minHeight: 56 }} />
            </Field>
          </Card>
        );
      })}

      <Card title="Summary">
        <table className="simple">
          <thead><tr><th>P</th><th>Score</th><th>Avg</th><th>Coaching?</th></tr></thead>
          <tbody>
            {result.ps.map((p) => (
              <tr key={p.p}><td>{p.name}</td><td>{p.score}/16</td><td>{p.avg.toFixed(2)}</td><td>{p.complete ? (p.coaching ? <Pill tone="bad">Yes</Pill> : 'No') : '—'}</td></tr>
            ))}
            <tr><th>Total</th><th>{result.total}/80</th><th>{fmtPct(result.percent)}</th><th>{result.complete ? (result.passed ? <Pill tone="ok">Pass</Pill> : <Pill tone="bad">Not yet</Pill>) : '—'}</th></tr>
          </tbody>
        </table>
        <Field label="Strengths"><textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} /></Field>
        <Field label="Coaching focus / next step"><textarea value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder={result.coachingFlags.length ? `Focus: ${result.coachingFlags.join(', ')}` : ''} /></Field>
        <Field label="Follow-up date"><input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} /></Field>
        <label className="row" style={{ fontWeight: 500 }}><input type="checkbox" checked={modAck} onChange={(e) => setModAck(e.target.checked)} /> I'm the MOD and I went over this with them</label>
        <label className="row" style={{ fontWeight: 500 }}><input type="checkbox" checked={tmAck} onChange={(e) => setTmAck(e.target.checked)} /> {person?.name || 'Team member'} acknowledges (tap on this phone)</label>
      </Card>

      {tried && problems.length > 0 && <div className="card tight" style={{ background: 'var(--bad-bg)' }}><ul style={{ margin: 0 }}>{problems.map((p) => <li key={p}>{p}</li>)}</ul></div>}
      <button className="btn" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Submit P5'}</button>
    </>
  );
}
