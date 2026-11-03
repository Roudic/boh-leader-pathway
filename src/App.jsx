import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useApp } from './data/AppContext.jsx';
import { store, demoMode } from './data/store.js';
import { can } from './lib/access.js';
import { APP_ROLES } from './lib/constants.js';
import { Loading, Toaster } from './components/ui.jsx';
import SignIn from './pages/SignIn.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ShiftHome from './pages/ShiftHome.jsx';
import Profile from './pages/Profile.jsx';
import P5Form from './pages/P5Form.jsx';
import P5View from './pages/P5View.jsx';
import Checklists from './pages/Checklists.jsx';
import ChecklistRun from './pages/ChecklistRun.jsx';
import SummaryForm from './pages/SummaryForm.jsx';
import Inbox from './pages/Inbox.jsx';
import Pathways from './pages/Pathways.jsx';
import ModulePage from './pages/ModulePage.jsx';
import Admin from './pages/Admin.jsx';
import Apply from './pages/Apply.jsx';

export default function App() {
  const { authUser, member, me, data, error } = useApp();

  if (!store) return <SetupNeeded />;
  if (authUser === undefined) return <Loading />;
  if (!authUser || member === false) return <SignIn notMember={member === false} error={error} />;
  if (!member || !data) return error ? <div className="center-screen"><p>Couldn't load data: {error}</p></div> : <Loading />;

  const isAdmin = can.admin(member);
  const evaluator = can.evaluate(member);
  const unread = isAdmin ? data.summaries.filter((s) => !s.readAt).length : 0;

  return (
    <>
      {demoMode && (
        <div className="demo-banner">
          Demo mode (local preview, not saved to Firebase) · <button className="btn link" style={{ color: '#ffd76a', fontSize: '.8rem' }} onClick={() => store.reset()}>reset demo</button>
        </div>
      )}
      <div className="topbar">
        <b>BOH Leaders</b>
        <div className="row">
          <div className="who">{me?.name || authUser.email}<br /><span style={{ opacity: 0.8 }}>{APP_ROLES[member.role]}</span></div>
          <button onClick={() => store.signOut()}>Sign out</button>
        </div>
      </div>
      <div className={`shell ${isAdmin ? 'wide' : ''}`}>
        <Routes>
          <Route path="/" element={isAdmin ? <Dashboard /> : evaluator ? <ShiftHome /> : <Navigate to={`/people/${member.personId}`} replace />} />
          <Route path="/shift" element={<ShiftHome />} />
          <Route path="/people/:id" element={<Profile />} />
          <Route path="/p5/new" element={evaluator ? <P5Form /> : <Navigate to="/" />} />
          <Route path="/p5/:id" element={<P5View />} />
          <Route path="/checklists" element={<Checklists />} />
          <Route path="/checklists/run" element={<ChecklistRun />} />
          <Route path="/summary/new" element={evaluator ? <SummaryForm /> : <Navigate to="/" />} />
          <Route path="/inbox" element={isAdmin ? <Inbox /> : <Navigate to="/" />} />
          <Route path="/inbox/:id" element={isAdmin ? <Inbox /> : <Navigate to="/" />} />
          <Route path="/pathways" element={<Pathways />} />
          <Route path="/pathways/:id" element={<ModulePage />} />
          <Route path="/apply" element={<Apply />} />
          <Route path="/admin" element={isAdmin ? <Admin /> : <Navigate to="/" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
      <nav className="tabbar">
        <Tab to="/" ic="🏠" label="Home" end />
        {evaluator && <Tab to="/p5/new" ic="⭐" label="P5 Eval" />}
        <Tab to="/checklists" ic="✅" label="Checklists" />
        <Tab to="/pathways" ic="📘" label="Pathways" />
        {isAdmin ? <Tab to="/inbox" ic="📥" label="Inbox" badge={unread} /> : evaluator ? <Tab to="/summary/new" ic="📝" label="Summary" /> : <Tab to={`/people/${member.personId}`} ic="👤" label="Me" />}
        {isAdmin && <Tab to="/admin" ic="⚙️" label="Admin" />}
      </nav>
      <Toaster />
    </>
  );
}

function Tab({ to, ic, label, end, badge }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
      <span className="ic" aria-hidden>{ic}</span>{label}
      {badge ? <span className="badge">{badge}</span> : null}
    </NavLink>
  );
}

function SetupNeeded() {
  return (
    <div className="center-screen">
      <div className="logo">BOH</div>
      <h1>Almost ready</h1>
      <p className="muted">Firebase isn't connected yet. Paste your Firebase web config into <code>src/firebase-config.js</code>, commit, and push. See SETUP.md, step 3.</p>
    </div>
  );
}
