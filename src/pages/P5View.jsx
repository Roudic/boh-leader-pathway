import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../data/AppContext.jsx';
import { store } from '../data/store.js';
import { can } from '../lib/access.js';
import { fmtPct, p5Config } from '../lib/p5.js';
import { fmtDate, nowIso } from '../lib/dates.js';
import { Card, Pill, toast } from '../components/ui.jsx';

export default function P5View() {
  const { id } = useParams();
  const { data, member, reload } = useApp();
  const nav = useNavigate();
  const e = data.p5Evals.find((x) => x.id === id);
  if (!e) return <p style={{ marginTop: 20 }}>Evaluation not found.</p>;
  const cfg = p5Config(data.settings);
  const name = (pid) => data.people.find((p) => p.id === pid)?.name || '—';
  const isMine = e.personId === member.personId;

  const ack = async () => {
    await store.update('p5Evals', e.id, { teamMemberSignedAt: nowIso() });
    await reload();
    toast('Acknowledged');
  };

  const uncheckAck = async () => {
    await store.update('p5Evals', e.id, { teamMemberSignedAt: null });
    await reload();
    toast('Acknowledgment unchecked');
  };

  const removeEval = async () => {
    if (!confirm(`Delete this P5 (${e.total}/80) for ${name(e.personId)}? This can't be undone.`)) return;
    await store.remove('p5Evals', e.id);
    nav(`/people/${e.personId}`, { replace: true });
    await reload();
    toast('P5 deleted');
  };

  return (
    <>
      <p style={{ marginTop: 12 }}><Link to={`/people/${e.personId}`}>← {name(e.personId)}</Link></p>
      <h1>P5 · {name(e.personId)}</h1>
      <Card tight>
        <div className="row between">
          <div>
            <div className="small muted">{fmtDate(e.date)} · {data.areas.find((a) => a.id === e.areaId)?.name} · {e.daypart} · {e.roleAtTime}</div>
            <div className="small muted">MOD: {name(e.evaluatorId)} · Shift Leader: {name(e.shiftLeaderId)}</div>
          </div>
          <div className="right">
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{e.total}/80</div>
            <Pill tone={e.passed ? 'ok' : 'bad'}>{fmtPct(e.percent)} · {e.passed ? 'Pass' : 'Not yet'}</Pill>
          </div>
        </div>
      </Card>
      <Card title="By P">
        <table className="simple">
          <tbody>
            {[1, 2, 3, 4, 5].map((p) => {
              const items = data.p5Items.filter((i) => i.pIndex === p);
              const k = `P${p}`;
              const flagged = e.coachingFlags?.includes(k);
              return (
                <tr key={p}>
                  <td>
                    <b>{items[0]?.pArea}</b> {flagged && <Pill tone="bad">Coaching focus</Pill>}
                    <div className="small muted">{items.map((i) => `${i.id}: ${e.scores?.[i.id] ?? '—'} (${cfg.scale[e.scores?.[i.id]] || ''})`).join(' · ')}</div>
                    {e.notes?.[k] && <div className="small" style={{ marginTop: 4 }}>“{e.notes[k]}”</div>}
                  </td>
                  <td className="right"><b>{e.pScores?.[k]}/16</b><div className="small muted">avg {Number(e.pAverages?.[k] ?? 0).toFixed(2)}</div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <Card title="Coaching">
        <p><b>Strengths:</b> {e.strengths || <span className="muted">—</span>}</p>
        <p><b>Next step:</b> {e.coachingNextStep || <span className="muted">—</span>}</p>
        <p><b>Follow-up:</b> {e.followUpDate ? fmtDate(e.followUpDate) : '—'}</p>
        <p className="small muted">MOD signed {e.modSignedAt ? fmtDate(e.modSignedAt) : '—'} · Team member {e.teamMemberSignedAt ? `acknowledged ${fmtDate(e.teamMemberSignedAt)}` : 'has not acknowledged'}</p>
        {isMine && !e.teamMemberSignedAt && <button className="btn" onClick={ack}>I've gone over this with my MOD</button>}
        {can.admin(member) && (
          <div className="stack">
            {e.teamMemberSignedAt && <button className="btn secondary" onClick={uncheckAck}>Uncheck team member acknowledgment</button>}
            <button className="btn secondary" onClick={removeEval}>Delete this P5</button>
          </div>
        )}
      </Card>
    </>
  );
}
