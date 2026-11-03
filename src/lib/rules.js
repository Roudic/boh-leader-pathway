// Promotion rules, prerequisite checklists, pipeline status, and dashboard flags.
// All thresholds come from settings (seeded from data/prerequisites.json and editable in Admin).
import { daysBetween, addDays } from './dates.js';
import { fmtPct } from './p5.js';

export const ROLE_KEY = { 'Area Captain': 'area_captain', 'Shift Leader': 'shift_leader', 'Assistant Captain': 'assistant_captain' };

export function tbdValue(settings, key, fallback) {
  const v = settings?.tbd?.[key];
  return v == null ? fallback : v;
}

// ---------- Attendance ----------
export function attendanceStats(records, settings, today) {
  const window = settings?.attendance?.window_days ?? 60;
  const excused = tbdValue(settings, 'excusedHandling', 'exclude');
  const inWindow = records.filter((r) => {
    const d = daysBetween(r.date, today);
    return d >= 0 && d < window;
  });
  let counted = 0;
  let onTime = 0;
  for (const r of inWindow) {
    if (r.status === 'excused') {
      if (excused === 'exclude') continue;
      counted++;
      if (excused === 'count_as_on_time') onTime++;
      continue;
    }
    counted++;
    if (r.status === 'on_time') onTime++;
  }
  return { window, counted, onTime, pct: counted ? (onTime / counted) * 100 : null };
}

export function statusFromTimes(scheduled, actual, settings) {
  if (!scheduled || !actual) return null;
  const grace = Number(tbdValue(settings, 'onTimeGraceMinutes', 0)) || 0;
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  return toMin(actual) <= toMin(scheduled) + grace ? 'on_time' : 'late';
}

// ---------- P5 ----------
export function countedP5(personId, evals, settings) {
  const mine = evals.filter((e) => e.personId === personId);
  if (!mine.length) return null;
  const which = tbdValue(settings, 'p5Counts', 'latest');
  const sorted = [...mine].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
  if (which === 'best') return [...mine].sort((a, b) => b.total - a.total)[0];
  return sorted[0];
}

export function latestP5(personId, evals) {
  const mine = evals.filter((e) => e.personId === personId);
  return mine.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''))[0] || null;
}

// ---------- Prerequisites ----------
function cmp(op, a, b) {
  if (a == null) return false;
  if (op === '>=') return a >= b;
  if (op === '>') return a > b;
  if (op === '<=') return a <= b;
  return a === b;
}

export function daysInRoles(personId, roles, roleHistory, today) {
  return roleHistory
    .filter((h) => h.personId === personId && roles.includes(h.role) && h.startDate)
    .reduce((sum, h) => sum + Math.max(0, daysBetween(h.startDate, h.endDate || today)), 0);
}

export function evaluatePrereq(pr, person, ctx) {
  const { settings, today } = ctx;
  const override = person.prereqOverrides?.[pr.id] || (pr.type === 'pathway_complete' ? person.pathwayComplete?.[pr.pathway] : null);
  let met = false;
  let current = '';
  let required = '';
  let missing = '';

  switch (pr.type) {
    case 'attendance_pct': {
      const s = attendanceStats(ctx.attendance.filter((a) => a.personId === person.id), settings, today);
      required = `${pr.value}%`;
      current = s.pct == null ? 'No shifts entered' : `${fmtPct(s.pct, 1)} (${s.onTime}/${s.counted})`;
      met = cmp(pr.operator, s.pct, pr.value);
      missing = s.pct == null ? `Attendance: no shifts entered (needs ${pr.value}%)` : `Attendance ${fmtPct(s.pct, 1)} (needs ${pr.value}%)`;
      break;
    }
    case 'pathway_complete': {
      // Pathways training runs in its own app. Completion is marked here by Joshua.
      const label = pr.pathway === 'captain' ? 'Captain' : 'Shift Leader';
      required = 'Pathways complete';
      current = 'Not marked complete';
      missing = `${label} Pathways not marked complete`;
      break;
    }
    case 'letter_count': {
      const allowed = pr.allowed_authors || [];
      const n = ctx.letters.filter((l) => l.personId === person.id && allowed.includes(l.authorRole)).length;
      required = `${pr.value} letters`;
      current = `${n}`;
      met = cmp(pr.operator, n, pr.value);
      missing = `${n} of ${pr.value} letters`;
      break;
    }
    case 'letters_from_all': {
      const managers = ctx.people.filter((p) => p.active !== false && p.isManager && p.id !== person.id);
      const have = managers.filter((m) => ctx.letters.some((l) => l.personId === person.id && (l.authorPersonId === m.id || (!l.authorPersonId && l.authorName?.trim().toLowerCase() === m.name.toLowerCase()))));
      const lacking = managers.filter((m) => !have.includes(m));
      required = `Letter from every manager (${managers.length})`;
      current = `${have.length}/${managers.length}`;
      met = managers.length > 0 && lacking.length === 0;
      missing = managers.length ? `Letters needed from: ${lacking.map((m) => m.name).join(', ')}` : 'No managers set up';
      break;
    }
    case 'p5_pct': {
      const e = countedP5(person.id, ctx.p5Evals, settings);
      required = `${pr.value}%`;
      current = e ? `${e.total}/80 (${fmtPct(e.percent)})` : 'No P5 yet';
      met = !!e && cmp(pr.operator, e.percent, pr.value);
      missing = e ? `P5 ${fmtPct(e.percent)} (needs ${pr.value}%)` : 'No P5 Evaluation yet';
      break;
    }
    case 'application_submitted': {
      const a = ctx.applications.find((x) => x.personId === person.id && x.targetRole === pr.target_role);
      met = !!a;
      required = 'Submitted';
      current = a ? 'Submitted' : 'Not submitted';
      missing = 'Application of interest not submitted';
      break;
    }
    case 'days_in_role': {
      const roles = [pr.role];
      if (tbdValue(settings, 'assistantDaysCount', false)) roles.push('Assistant Captain');
      const d = daysInRoles(person.id, roles, ctx.roleHistory, today);
      required = `${pr.value} days`;
      current = `${d} days`;
      met = cmp(pr.operator, d, pr.value);
      missing = `${d} of ${pr.value} days as Captain`;
      break;
    }
    default:
      current = 'Unknown rule';
  }

  if (override && !met) {
    return { ...pr, met: true, overridden: true, current: `Met outside the app`, required, note: override.note, missing: '' };
  }
  return { ...pr, met, current, required, missing: met ? '' : missing };
}

export function prereqChecklist(person, ctx) {
  const key = ROLE_KEY[person.pipelineTarget];
  if (!key) return null;
  const list = ctx.settings?.roles?.[key]?.prerequisites;
  if (!Array.isArray(list)) return { tbd: true, items: [] };
  const items = list.map((pr) => evaluatePrereq(pr, person, ctx));
  return { tbd: false, items, met: items.filter((i) => i.met).length, total: items.length, allMet: items.every((i) => i.met) };
}

// ---------- Evaluation / training shifts ----------
export function shiftSummary(person, ctx) {
  const key = ROLE_KEY[person.pipelineTarget];
  const cfg = ctx.settings?.roles?.[key]?.shifts;
  if (!cfg) return null;
  const kind = key === 'shift_leader' ? 'training' : 'evaluation';
  const shifts = ctx.shifts.filter((s) => s.personId === person.id && s.kind === kind).sort((a, b) => a.shiftNumber - b.shiftNumber);
  const earned = shifts.reduce((a, s) => a + (Number(s.pointsEarned) || 0), 0);
  const possible = shifts.reduce((a, s) => a + (Number(s.pointsPossible) || 0), 0);
  const pct = possible ? (earned / possible) * 100 : null;
  const done = shifts.length >= cfg.count;
  let passed = null; // null = no rule (TBD) or not done
  if (done && cfg.pass_pct != null) passed = pct != null && pct >= cfg.pass_pct;
  return { kind, cfg, shifts, earned, possible, pct, done, passed };
}

// ---------- Pipeline status ----------
export function pipelineStatus(person, ctx) {
  if (person.statusOverride?.status) return { status: person.statusOverride.status, overridden: true, note: person.statusOverride.note };
  if (!person.pipelineTarget) return { status: 'none' };
  const check = prereqChecklist(person, ctx);
  if (!check || check.tbd) return { status: 'prereqs_tbd' };
  const shifts = shiftSummary(person, ctx);
  if (!check.allMet) {
    const pathwayMissing = check.items.some((i) => i.type === 'pathway_complete' && !i.met);
    return { status: pathwayMissing ? 'in_pathways' : 'prerequisites_in_progress', dropped: shifts?.shifts.length > 0 || !!person.approvedForPromotion };
  }
  if (!shifts.done) return { status: 'ready_for_eval_shifts' };
  if (shifts.kind === 'training') return { status: shifts.passed ? 'ready_for_promotion' : 'eval_shifts_complete' };
  return { status: person.approvedForPromotion ? 'ready_for_promotion' : 'eval_shifts_complete' };
}

export function pipelineStage(person) {
  const t = person.pipelineTarget;
  if (t === 'Shift Leader') return 'Shift Leader candidate';
  if (t === 'Area Captain') return 'Area Captain candidate';
  if (t === 'Assistant Captain') return 'Assistant Captain candidate';
  if (['Shift Leader', 'Area Captain', 'Assistant Captain'].includes(person.currentRole)) return person.currentRole;
  if (person.currentRole === 'Team Member') return 'Team Member';
  return null; // Admin / Manager are off the board
}

export function attendanceTarget(person, settings) {
  const key = ROLE_KEY[person.pipelineTarget];
  const pr = settings?.roles?.[key]?.prerequisites;
  if (!Array.isArray(pr)) return null;
  return pr.find((p) => p.type === 'attendance_pct')?.value ?? null;
}

// ---------- Dashboard flags ----------
export function dashboardFlags(ctx) {
  const { people, areas, settings, today } = ctx;
  const flags = [];
  const passScore = settings?.p5?.pass_score ?? 72;
  const active = people.filter((p) => p.active !== false);

  for (const p of active) {
    const target = attendanceTarget(p, settings);
    if (target != null) {
      const s = attendanceStats(ctx.attendance.filter((a) => a.personId === p.id), settings, today);
      if (s.pct != null && s.pct < target) flags.push({ kind: 'attendance', personId: p.id, text: `${p.name}: attendance ${fmtPct(s.pct, 1)} (needs ${target}%)` });
    }
    const e = latestP5(p.id, ctx.p5Evals);
    if (e) {
      if (e.total < passScore) flags.push({ kind: 'p5', personId: p.id, text: `${p.name}: latest P5 ${e.total}/80 (${fmtPct(e.percent)}), under ${passScore}` });
      if (e.coachingFlags?.length) flags.push({ kind: 'coaching', personId: p.id, text: `${p.name}: P5 coaching focus ${e.coachingFlags.join(', ')} (average under ${settings?.p5?.coaching_avg ?? 3})` });
      if (e.followUpDate && e.followUpDate <= today) flags.push({ kind: 'followup', personId: p.id, text: `${p.name}: P5 follow-up due ${e.followUpDate}` });
    }
    const st = pipelineStatus(p, ctx);
    if (st.dropped) flags.push({ kind: 'dropped', personId: p.id, text: `${p.name}: a prerequisite dropped after shifts/approval started` });
  }

  for (const a of areas) {
    if (!a.assistantCaptainId) {
      const pot = people.find((p) => p.id === a.potentialAssistantId);
      flags.push({ kind: 'open', text: `${a.name}: Assistant Captain open${pot ? ` (${pot.name} potential)` : ''}` });
    }
  }

  for (const n of ctx.coaching) {
    if (!n.resolved && n.followUpDate && n.followUpDate <= today) {
      const p = people.find((x) => x.id === n.personId);
      flags.push({ kind: 'followup', personId: n.personId, text: `${p?.name || 'Someone'}: coaching follow-up due ${n.followUpDate}` });
    }
  }

  // End-of-shift summaries missing (past 7 days, since the app started, not counting today)
  const start = settings?.startedOn || today;
  for (let i = 1; i <= 7; i++) {
    const d = addDays(today, -i);
    if (d < start) break;
    for (const dp of ['AM', 'PM']) {
      if (!ctx.summaries.some((s) => s.date === d && s.daypart === dp)) flags.push({ kind: 'summary', text: `No end-of-shift summary for ${d} ${dp}` });
    }
  }
  return flags;
}
