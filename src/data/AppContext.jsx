import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { store, setActor } from './store.js';
import { can } from '../lib/access.js';
import { todayIso, addDays } from '../lib/dates.js';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.name || '').localeCompare(b.name || '');

async function loadAll(member) {
  const today = todayIso();
  const mine = [['personId', '==', member.personId]];
  const staff = can.seeAll(member);
  const scoped = (col, extra = []) => store.list(col, staff ? extra : [...mine, ...extra]);
  const [settings, areas, people, p5Items,
    attendance, letters, applications, p5Evals, shifts, roleHistory, coaching, summaries, members] = await Promise.all([
    store.get('settings', 'rules'),
    store.list('areas'),
    store.list('people'),
    store.list('p5Items'),
    staff ? store.list('attendance', [['date', '>=', addDays(today, -180)]]) : store.list('attendance', mine),
    scoped('letters'),
    scoped('applications'),
    scoped('p5Evals'),
    scoped('shifts'),
    scoped('roleHistory'),
    staff ? store.list('coaching') : store.list('coaching', [...mine, ['shared', '==', true]]),
    member.role === 'admin' ? store.list('summaries') : staff ? store.list('summaries', [['shiftLeaderId', '==', member.personId]]) : Promise.resolve([]),
    member.role === 'admin' ? store.list('members') : Promise.resolve([]),
  ]);
  return {
    today, settings, areas: areas.sort(byOrder), people: people.sort(byOrder), p5Items: p5Items.sort(byOrder),
    attendance, letters, applications, p5Evals, shifts, roleHistory, coaching, summaries, members,
  };
}

export function AppProvider({ children }) {
  const [authUser, setAuthUser] = useState(undefined); // undefined = still checking
  const [member, setMember] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => store?.onAuth(async (u) => {
    setError('');
    setData(null);
    setMember(null);
    setAuthUser(u);
    if (!u) return;
    try {
      const m = await store.get('members', u.email);
      if (!m || m.active === false) { setMember(false); return; }
      setActor(m.personId);
      setMember(m);
    } catch (e) {
      setMember(false);
      setError(e.message);
    }
  }), []);

  const reload = useCallback(async () => {
    if (!member) return;
    try { setData(await loadAll(member)); } catch (e) { setError(e.message); }
  }, [member]);

  useEffect(() => { reload(); }, [reload]);

  const me = data?.people.find((p) => p.id === member?.personId) || null;
  return <Ctx.Provider value={{ authUser, member, me, data, reload, error }}>{children}</Ctx.Provider>;
}
