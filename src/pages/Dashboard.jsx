import { Link } from 'react-router-dom';
import { useApp } from '../data/AppContext.jsx';
import { dashboardFlags, pipelineStage, pipelineStatus, prereqChecklist } from '../lib/rules.js';
import { PIPELINE_STAGES, STATUS_LABEL } from '../lib/constants.js';
import { fmtDate } from '../lib/dates.js';
import { Card, Pill, Tbd } from '../components/ui.jsx';

const areaName = (areas, id) => areas.find((a) => a.id === id)?.name || '';

export function statusTone(s) {
  return { ready_for_promotion: 'ok', ready_for_eval_shifts: 'ok', eval_shifts_complete: 'warn', prereqs_tbd: '', in_pathways: 'warn', prerequisites_in_progress: 'warn' }[s] || '';
}

export default function Dashboard() {
  const { data } = useApp();
  const flags = dashboardFlags(data);
  const active = data.people.filter((p) => p.active !== false);
  const cards = active.map((p) => ({ p, stage: pipelineStage(p), status: pipelineStatus(p, data), check: prereqChecklist(p, data) })).filter((c) => c.stage);
  const candidates = cards.filter((c) => c.p.pipelineTarget);
  const unread = data.summaries.filter((s) => !s.readAt).length;
  const tone = (k) => (['attendance', 'p5', 'dropped'].includes(k) ? 'bad' : k === 'open' ? 'info' : '');

  return (
    <>
      <div className="row between" style={{ marginTop: 12 }}>
        <h1 style={{ margin: 0 }}>Pipeline</h1>
        <span className="muted small">{fmtDate(data.today)}</span>
      </div>

      <div className="bigtiles" style={{ marginTop: 10 }}>
        <Link className="tile" to="/p5/new"><span className="ic">⭐</span><b>New P5 Evaluation</b></Link>
        <Link className="tile" to="/inbox"><span className="ic">📥</span><b>Shift summaries</b><span className="muted small">{unread} unread</span></Link>
      </div>

      <h2>Area coverage</h2>
      <div className="coverage">
        {data.areas.map((a) => {
          const cap = data.people.find((p) => p.id === a.captainId);
          const ac = data.people.find((p) => p.id === a.assistantCaptainId);
          const pot = data.people.find((p) => p.id === a.potentialAssistantId);
          const capDp = cap?.daypart;
          const acDp = a.assistantDaypart || (capDp ? (capDp === 'AM' ? 'PM' : 'AM') : null);
          return (
            <div className="c" key={a.id}>
              <b>{a.name}</b>
              <div>Capt: {cap ? <Link to={`/people/${cap.id}`}>{cap.name}</Link> : <Pill tone="bad">Open</Pill>} {cap && (capDp || <Tbd />)}</div>
              <div>Asst: {ac ? <Link to={`/people/${ac.id}`}>{ac.name}</Link> : <Pill tone="warn">Open</Pill>} {acDp || <Tbd />}</div>
              {!ac && pot && <div className="muted small">Potential: <Link to={`/people/${pot.id}`}>{pot.name}</Link></div>}
            </div>
          );
        })}
      </div>

      <Card title={`Flags (${flags.length})`}>
        {flags.length === 0 && <p className="muted">Nothing needs attention.</p>}
        {flags.map((f, i) => {
          const body = <><span className="dot" /><span>{f.text}</span></>;
          if (f.personId) return <Link key={i} className={`flag ${tone(f.kind)}`} to={`/people/${f.personId}`}>{body}</Link>;
          const to = f.kind === 'summary' ? '/inbox' : null;
          return to ? <Link key={i} className={`flag ${tone(f.kind)}`} to={to}>{body}</Link> : <div key={i} className={`flag ${tone(f.kind)}`}>{body}</div>;
        })}
      </Card>

      <h2>Pipeline board</h2>
      <div className="board">
        {PIPELINE_STAGES.map((stage) => {
          const inCol = cards.filter((c) => c.stage === stage);
          return (
            <div className="col" key={stage}>
              <h3>{stage}<span className="muted">{inCol.length}</span></h3>
              {inCol.length === 0 && <div className="muted small">No one yet</div>}
              {inCol.map(({ p, status, check }) => (
                <Link className="pcard" key={p.id} to={`/people/${p.id}`}>
                  <div className="row between"><span className="name">{p.name}</span>{check && !check.tbd && <span className="small muted">{check.met}/{check.total}</span>}</div>
                  <div className="small muted">{[areaName(data.areas, p.areaId), p.daypart || (p.areaId ? 'daypart TBD' : '')].filter(Boolean).join(' · ')}</div>
                  {p.pipelineTarget && <div className="small">→ {p.pipelineTarget}</div>}
                  <div style={{ marginTop: 4 }}>
                    {status.status !== 'none' ? <Pill tone={statusTone(status.status)}>{STATUS_LABEL[status.status]}</Pill> : <span className="small muted">{p.statusLabel}</span>}
                  </div>
                </Link>
              ))}
            </div>
          );
        })}
      </div>

      <Card title="What's missing">
        {candidates.map(({ p, status, check }) => (
          <div key={p.id} className="flag" style={{ display: 'block' }}>
            <div className="row between">
              <Link to={`/people/${p.id}`}><b>{p.name}</b></Link>
              <span className="small muted">→ {p.pipelineTarget}</span>
            </div>
            {check?.tbd ? (
              <div className="small"><Tbd>Prerequisites TBD</Tbd> <span className="muted">({p.pipelineTarget} prerequisites aren't defined yet)</span></div>
            ) : check.allMet ? (
              <div className="small" style={{ color: 'var(--ok)' }}>All prerequisites met · {STATUS_LABEL[status.status]}</div>
            ) : (
              <ul className="small" style={{ margin: '4px 0 0', paddingLeft: 18, color: 'var(--bad)' }}>
                {check.items.filter((i) => !i.met).map((i) => <li key={i.id}>{i.missing}</li>)}
              </ul>
            )}
          </div>
        ))}
      </Card>
    </>
  );
}
