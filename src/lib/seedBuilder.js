// Builds the initial Firestore documents from the files in data/.
// Shared by scripts/seed.mjs (real Firestore) and demo mode (local preview).
import { parseCsv } from './csv.js';

const AREA_IDS = { 'Breading/Raw': 'A1', Prep: 'A2', Centerline: 'A3' };

function cleanDaypart(v) {
  return v === 'AM' || v === 'PM' ? v : null; // "TBD" / "All" / blank → null (shown as TBD)
}

function p5Section(prereqs) {
  const p = prereqs.p5_evaluation;
  const avg = Number((p.coaching_flag.match(/<\s*(\d+(\.\d+)?)/) || [])[1] ?? 3);
  return {
    evaluator: p.evaluator,
    applies_to: p.applies_to,
    ps: p.ps,
    scale: p.scale,
    max_score: p.max_score,
    pass_score: p.pass_score,
    pass_pct: p.pass_pct,
    coaching_avg: avg,
    note_required_for_scores: p.note_required_for_scores,
  };
}

export function buildSettings(prereqs) {
  const roles = prereqs.roles;
  const slRule = roles.shift_leader.after_prerequisites.pass_rule;
  const slPct = Number((slRule.match(/>=\s*(\d+(\.\d+)?)/) || [])[1]);
  return {
    version: prereqs.version,
    source: prereqs.source,
    attendance: { window_days: prereqs.attendance.window_days },
    roles: {
      area_captain: {
        prerequisites: roles.area_captain.prerequisites,
        shifts: {
          label: roles.area_captain.after_prerequisites.label,
          count: roles.area_captain.after_prerequisites.count,
          pass_pct: null, // TBD
          pass_rule_text: roles.area_captain.after_prerequisites.pass_rule,
        },
      },
      shift_leader: {
        prerequisites: roles.shift_leader.prerequisites,
        shifts: {
          label: roles.shift_leader.after_prerequisites.label,
          count: roles.shift_leader.after_prerequisites.count,
          pass_pct: Number.isFinite(slPct) ? slPct : null,
          pass_rule_text: slRule,
        },
      },
      assistant_captain: {
        prerequisites: null, // TBD: not defined
        note: roles.assistant_captain.prerequisites,
      },
    },
    p5: p5Section(prereqs),
    // Everything below is TBD in the spec. null = TBD (UI shows "TBD"; logic uses the spec's stated default where one exists).
    tbd: {
      onTimeGraceMinutes: null, // default: on time = at or before scheduled start (0)
      excusedHandling: null, // default: 'exclude' excused shifts from the count
      p5Counts: null, // default: 'latest'
      assistantDaysCount: null, // default: false (Area Captain days only)
      daypartTimes: { AM: null, PM: null },
      evalScoreSheet: null,
      trainingScoreSheet: null,
    },
    summaryContact: { phone: '', email: '' },
  };
}

export function buildSeed({ rosterCsv, areasCsv, p5Csv, prereqs, today }) {
  const out = {
    settings: {}, areas: {}, people: {}, roleHistory: {}, p5Items: {},
  };
  const meta = { createdAt: today, updatedAt: today, createdBy: 'seed' };

  out.settings.rules = { ...buildSettings(prereqs), startedOn: today, ...meta };

  // People
  const roster = parseCsv(rosterCsv).filter((r) => r.person_id && r.name && r.name !== 'OPEN');
  for (const r of roster) {
    const flags = (r.flags || '').split(';').map((f) => f.trim()).filter(Boolean);
    const target = r.pipeline_target || null;
    const person = {
      name: r.name,
      currentRole: r.current_role,
      areaId: AREA_IDS[r.area] || null,
      daypart: cleanDaypart(r.daypart),
      isAdmin: flags.includes('admin'),
      isManager: flags.includes('manager'),
      isCertifiedTrainer: flags.includes('certified_trainer') || /certified trainer/i.test(r.current_role),
      active: true,
      roleStartDate: null,
      pipelineTarget: target,
      statusLabel: r.pipeline_status || '',
      notes: r.notes || '',
      prereqOverrides: {},
      pathwayComplete: {},
      ...meta,
    };
    if (flags.includes('prereqs_met_outside_app') && target === 'Shift Leader') {
      const note = 'Completed outside the app (CFA Pathways); confirmed by Joshua 11/3/2026';
      for (const pr of prereqs.roles.shift_leader.prerequisites) {
        person.prereqOverrides[pr.id] = { note, by: 'seed', at: today };
      }
      person.pathwayComplete.shift_leader = { note, by: 'seed', at: today };
    }
    out.people[r.person_id] = person;
    out.roleHistory[`${r.person_id}_current`] = {
      personId: r.person_id,
      role: r.current_role,
      areaId: person.areaId,
      daypart: person.daypart,
      startDate: null,
      endDate: null,
      reason: 'Seeded from roster (start date unknown)',
      ...meta,
    };
  }

  // Areas
  const areas = parseCsv(areasCsv);
  for (const a of areas) {
    const id = a.area_id || AREA_IDS[a.area_name];
    const captain = roster.find((r) => r.current_role === 'Area Captain' && AREA_IDS[r.area] === id);
    const assistant = roster.find((r) => r.current_role === 'Assistant Captain' && AREA_IDS[r.area] === id);
    const potential = roster.find((r) => r.pipeline_target === 'Assistant Captain' && AREA_IDS[r.area] === id);
    out.areas[id] = {
      name: a.area_name,
      order: Number(id.slice(1)),
      captainId: captain?.person_id || null,
      assistantCaptainId: assistant?.person_id || null,
      potentialAssistantId: potential?.person_id || null,
      assistantDaypart: cleanDaypart(a.assistant_captain_daypart),
      ...meta,
    };
  }

  // P5 items: IDs 1.1–5.4 in file order, 4 per P
  const items = parseCsv(p5Csv);
  const counters = {};
  items.forEach((it, idx) => {
    const pIndex = Number((it.p_area.match(/^P(\d)/) || [])[1]);
    counters[pIndex] = (counters[pIndex] || 0) + 1;
    const id = `${pIndex}.${counters[pIndex]}`;
    out.p5Items[id] = { pIndex, pArea: it.p_area, behavior: it.behavior, scale: it.scale, order: idx + 1, ...meta };
  });

  return out;
}
