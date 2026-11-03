import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../data/AppContext.jsx';
import { checklistGrid } from '../lib/rules.js';
import { CHECKPOINT_LABEL } from '../lib/constants.js';
import { can } from '../lib/access.js';
import { Card, Field, Seg, Tbd } from '../components/ui.jsx';

export const RUN_STATUS = {
  no_items: ['—', ''],
  open: ['To do', ''],
  overseen: ['Overseen · verify', 'warn'],
  sent_back: ['Sent back', 'bad'],
  verified: ['Verified ✓', 'ok'],
};

export default function Checklists() {
  const { data, member, me } = useApp();
  const [date, setDate] = useState(data.today);
  const [dp, setDp] = useState(new Date().getHours() < 15 ? 'AM' : 'PM');
  const grid = checklistGrid(date, dp, data);
  const anyItems = data.checklistItems.length > 0;
  const verifier = can.verify(member);

  return (
    <>
      <h1 style={{ marginTop: 12 }}>Area checklists</h1>
      <p className="muted small" style={{ marginTop: -6 }}>
        {verifier ? 'Open an area to verify it or send it back.' : 'Captains oversee: make sure each item is actually done, then mark it overseen.'}
      </p>
      <Card tight>
        <div className="btns">
          <Field label="Date"><input type="date" value={date} max={data.today} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Daypart"><Seg value={dp} options={['AM', 'PM']} onChange={setDp} /></Field>
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>AM/PM times: {data.settings?.tbd?.daypartTimes?.AM || <Tbd />} / {data.settings?.tbd?.daypartTimes?.PM || <Tbd />}</p>
      </Card>

      {!anyItems && (
        <Card tight>
          <p style={{ margin: 0 }}><Tbd>Checklist items TBD</Tbd> {can.admin(member) ? <>Add items in <Link to="/admin">Admin → Checklists</Link>.</> : 'Joshua is adding the items for each area.'}</p>
        </Card>
      )}

      {grid.map(({ area, cells }) => {
        const mine = me?.areaId === area.id && !verifier;
        return (
          <Card key={area.id} tight>
            <div className="row between"><h2 style={{ margin: 0 }}>{area.name}</h2>{mine && <span className="pill">Your area</span>}</div>
            {cells.map((c) => {
              const [label, tone] = RUN_STATUS[c.status];
              const to = `/checklists/run?date=${date}&dp=${dp}&area=${area.id}&cp=${c.checkpoint}`;
              return c.itemCount ? (
                <Link key={c.checkpoint} className="list-link" to={to}>
                  <span><b>{CHECKPOINT_LABEL[c.checkpoint]}</b> <span className="muted small">{c.itemCount} items</span></span>
                  <span className={`pill ${tone}`}>{label}</span>
                </Link>
              ) : (
                <div key={c.checkpoint} className="list-link"><span><b>{CHECKPOINT_LABEL[c.checkpoint]}</b></span><Tbd>items TBD</Tbd></div>
              );
            })}
          </Card>
        );
      })}
    </>
  );
}
