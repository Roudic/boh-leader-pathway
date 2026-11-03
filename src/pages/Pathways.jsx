import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../data/AppContext.jsx';
import { can } from '../lib/access.js';
import { pathwayFor, pathwayProgress } from '../lib/rules.js';
import { Bar, Card, Pill, Seg } from '../components/ui.jsx';

export const PATHWAY_LABEL = { captain: 'Captain Pathways', shift_leader: 'Shift Leader Pathways' };

export default function Pathways() {
  const { data, me, member } = useApp();
  const staff = can.seeAll(member);
  const [pathway, setPathway] = useState(me ? pathwayFor(me) : 'captain');
  const prog = pathwayProgress(member.personId, pathway, data.modules, data.progress);
  const manual = me?.pathwayComplete?.[pathway];

  return (
    <>
      <h1 style={{ marginTop: 12 }}>Pathways</h1>
      {staff && <Seg value={pathway} options={[['captain', 'Captain'], ['shift_leader', 'Shift Leader']]} onChange={setPathway} />}
      <Card tight>
        <div className="row between"><b>{PATHWAY_LABEL[pathway]}</b><span className="small">{prog.passedRequired}/{prog.requiredCount} required passed</span></div>
        <div style={{ marginTop: 8 }}><Bar pct={prog.requiredCount ? (prog.passedRequired / prog.requiredCount) * 100 : 0} /></div>
        {manual && <p className="small" style={{ color: 'var(--ok)' }}>Marked complete: {manual.note}</p>}
      </Card>
      <Card tight>
        {prog.rows.length === 0 && <p className="muted">No modules yet.</p>}
        {prog.rows.map(({ module: m, progress: p }) => (
          <Link key={m.id} to={`/pathways/${m.id}`} className="list-link">
            <span>{m.order}. {m.title}{!m.required && <span className="muted small"> (optional)</span>}</span>
            {p?.status === 'passed' ? <Pill tone="ok">Passed{p.bestPct != null ? ` ${Math.round(p.bestPct)}%` : ''}</Pill> : p?.status === 'in_progress' ? <Pill tone="warn">In progress</Pill> : <Pill>Not started</Pill>}
          </Link>
        ))}
      </Card>
      {can.admin(member) && <p className="small muted">Add or edit modules and quizzes in <Link to="/admin">Admin → Pathways</Link>.</p>}
    </>
  );
}
