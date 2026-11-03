// P5 Evaluation scoring. Thresholds come from settings.p5 (seeded from prerequisites.json).

export function p5Config(settings) {
  const p = settings?.p5 || {};
  return {
    maxScore: p.max_score ?? 80,
    passScore: p.pass_score ?? 72,
    coachAvg: p.coaching_avg ?? 3,
    noteFor: p.note_required_for_scores ?? [1, 2],
    scale: p.scale ?? { 1: 'Not seen', 2: 'Sometimes', 3: 'Consistent', 4: 'Leads others in it' },
  };
}

// items: [{id:'1.1', pIndex:1, pArea:'P1 Purpose Driven', ...}]; scores: {'1.1': 3, ...}
export function scoreP5(items, scores, settings) {
  const cfg = p5Config(settings);
  const ps = [1, 2, 3, 4, 5].map((p) => {
    const its = items.filter((i) => i.pIndex === p);
    const vals = its.map((i) => scores[i.id]).filter((v) => v != null);
    const score = vals.reduce((a, b) => a + b, 0);
    const complete = vals.length === its.length && its.length > 0;
    const avg = its.length ? score / its.length : 0;
    return {
      p,
      name: its[0]?.pArea || `P${p}`,
      score,
      max: its.length * 4,
      avg,
      complete,
      coaching: complete && avg < cfg.coachAvg,
      needsNote: vals.some((v) => cfg.noteFor.includes(v)),
    };
  });
  const scored = items.filter((i) => scores[i.id] != null).length;
  const total = ps.reduce((a, b) => a + b.score, 0);
  const percent = (total / cfg.maxScore) * 100;
  return {
    ps,
    total,
    max: cfg.maxScore,
    percent,
    passed: total >= cfg.passScore,
    complete: scored === items.length && items.length > 0,
    scored,
    coachingFlags: ps.filter((p) => p.coaching).map((p) => `P${p.p}`),
  };
}

export function fmtPct(n, digits = 2) {
  if (n == null || Number.isNaN(n)) return '—';
  let s = n.toFixed(digits);
  if (s.includes('.')) s = s.replace(/\.?0+$/, '');
  return `${s}%`;
}
