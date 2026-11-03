import { Link } from 'react-router-dom';
import { useApp } from '../data/AppContext.jsx';
import { Card, Pill } from '../components/ui.jsx';
import { fmtDate } from '../lib/dates.js';

export default function ShiftHome() {
  const { data, me, member } = useApp();
  const leaders = data.people.filter((p) => p.active !== false && (['Area Captain', 'Assistant Captain'].includes(p.currentRole) || (p.pipelineTarget && p.pipelineTarget !== 'Shift Leader')));
  const mySummaryToday = data.summaries.find((s) => s.date === data.today && s.shiftLeaderId === member.personId);

  return (
    <>
      <h1 style={{ marginTop: 12 }}>Hi {me?.name?.split(' ')[0]} 👋</h1>
      <p className="muted" style={{ marginTop: -6 }}>{fmtDate(data.today)}</p>
      <div className="bigtiles">
        <Link className="tile" to="/p5/new"><span className="ic">⭐</span><b>P5 Evaluation</b><span className="muted small">Score a Captain</span></Link>
        <Link className="tile" to="/summary/new"><span className="ic">📝</span><b>End-of-shift summary</b><span className="muted small">{mySummaryToday ? `Sent ${mySummaryToday.daypart} ✓` : 'Send to Joshua'}</span></Link>
        <Link className="tile" to={`/people/${member.personId}`}><span className="ic">👤</span><b>My progress</b></Link>
      </div>

      <Card title="Captains & candidates">
        {leaders.map((p) => (
          <Link key={p.id} className="list-link" to={`/people/${p.id}`}>
            <span>{p.name}<br /><span className="muted small">{p.currentRole}{p.pipelineTarget ? ` → ${p.pipelineTarget}` : ''}</span></span>
            <Pill>{data.areas.find((a) => a.id === p.areaId)?.name || ''}</Pill>
          </Link>
        ))}
      </Card>
    </>
  );
}
