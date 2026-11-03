import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../data/AppContext.jsx';
import { store } from '../data/store.js';
import { nowIso } from '../lib/dates.js';
import { Card, Markdown, Pill, Tbd, toast } from '../components/ui.jsx';

export default function ModulePage() {
  const { id } = useParams();
  const { data, member, reload } = useApp();
  const m = data.modules.find((x) => x.id === id);
  const progId = `${member.personId}_${id}`;
  const prog = data.progress.find((p) => p.id === progId);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!m) return <p style={{ marginTop: 20 }}>Module not found.</p>;

  const questions = m.questions || [];
  const passPct = m.passPct ?? data.settings?.tbd?.quizPassPct ?? null;

  const record = async (pct) => {
    const passed = questions.length === 0 ? true : passPct != null && pct >= passPct;
    const best = Math.max(pct ?? 0, prog?.bestPct ?? 0);
    const status = passed || prog?.status === 'passed' ? 'passed' : 'in_progress';
    await store.set('progress', progId, {
      personId: member.personId, moduleId: id, status,
      bestPct: questions.length ? best : null, attempts: (prog?.attempts || 0) + 1,
      completedAt: status === 'passed' ? prog?.completedAt || nowIso() : null,
    });
    await reload();
    return passed;
  };

  const submitQuiz = async () => {
    if (Object.keys(answers).length < questions.length) { toast('Answer every question'); return; }
    setBusy(true);
    const correct = questions.filter((q, i) => answers[i] === q.correctIndex).length;
    const pct = (correct / questions.length) * 100;
    try {
      const passed = await record(pct);
      setResult({ correct, pct, passed });
    } catch (e) { toast(`Couldn't save: ${e.message}`); }
    setBusy(false);
  };

  const markRead = async () => {
    setBusy(true);
    try { await record(null); toast('Module complete'); } catch (e) { toast(`Couldn't save: ${e.message}`); }
    setBusy(false);
  };

  return (
    <>
      <p style={{ marginTop: 12 }}><Link to="/pathways">← Pathways</Link></p>
      <h1>{m.title}</h1>
      {prog?.status === 'passed' && <Pill tone="ok">Passed</Pill>}
      <Card><Markdown text={m.content} /></Card>

      {questions.length === 0 ? (
        prog?.status !== 'passed' && !m.title.startsWith('TBD') && <button className="btn" disabled={busy} onClick={markRead}>I've finished this module</button>
      ) : (
        <Card title={`Quiz (${questions.length})`} right={<span className="small muted">Pass mark: {passPct != null ? `${passPct}%` : <Tbd />}</span>}>
          {questions.map((q, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <b>{i + 1}. {q.prompt}</b>
              <div className="stack" style={{ marginTop: 6 }}>
                {q.choices.map((c, ci) => {
                  const chosen = answers[i] === ci;
                  const show = result && (ci === q.correctIndex || chosen);
                  return (
                    <button key={ci} type="button" className={`btn secondary`} disabled={!!result}
                      style={{ justifyContent: 'flex-start', textAlign: 'left', borderColor: chosen ? 'var(--red)' : undefined, background: show ? (ci === q.correctIndex ? 'var(--ok-bg)' : 'var(--bad-bg)') : undefined }}
                      onClick={() => setAnswers((a) => ({ ...a, [i]: ci }))}>
                      {c}
                    </button>
                  );
                })}
              </div>
              {result && q.explanation && <p className="small muted">{q.explanation}</p>}
            </div>
          ))}
          {result ? (
            <>
              <p><b>Score: {result.correct}/{questions.length} ({Math.round(result.pct)}%)</b> {passPct == null ? <span className="muted">· pass mark is TBD, so this can't count as passed yet</span> : result.passed ? <Pill tone="ok">Passed</Pill> : <Pill tone="bad">Not yet</Pill>}</p>
              <button className="btn secondary" onClick={() => { setAnswers({}); setResult(null); }}>Try again</button>
            </>
          ) : (
            <button className="btn" disabled={busy} onClick={submitQuiz}>Submit quiz</button>
          )}
          {prog && <p className="small muted">Attempts: {prog.attempts} · Best: {prog.bestPct != null ? `${Math.round(prog.bestPct)}%` : '—'}</p>}
        </Card>
      )}
    </>
  );
}
