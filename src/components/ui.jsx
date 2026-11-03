import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtDate } from '../lib/dates.js';

export const Tbd = ({ children = 'TBD' }) => <span className="tbd">{children}</span>;

export function Pill({ tone, children }) {
  return <span className={`pill ${tone || ''}`}>{children}</span>;
}

export function Card({ title, right, children, tight }) {
  return (
    <div className={`card ${tight ? 'tight' : ''}`}>
      {title && <div className="row between"><h2 style={{ margin: 0 }}>{title}</h2>{right}</div>}
      {title ? <div style={{ marginTop: 8 }}>{children}</div> : children}
    </div>
  );
}

export function Field({ label, children, error, hint }) {
  return (
    <div>
      {label && <label>{label}</label>}
      {children}
      {hint && <div className="muted small" style={{ marginTop: 4 }}>{hint}</div>}
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}

export function Seg({ value, options, onChange }) {
  return (
    <div className="seg">
      {options.map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return <button type="button" key={v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>;
      })}
    </div>
  );
}

export function PersonLink({ person }) {
  if (!person) return <span className="muted">—</span>;
  return <Link to={`/people/${person.id}`}>{person.name}</Link>;
}

export const D = ({ v }) => (v ? fmtDate(v) : <span className="muted">—</span>);

let toastSetter = null;
export function toast(msg) { toastSetter?.(msg); }
export function Toaster() {
  const [msg, setMsg] = useState('');
  useEffect(() => { toastSetter = setMsg; return () => { toastSetter = null; }; }, []);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(''), 2600); return () => clearTimeout(t); }, [msg]);
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}

export function Loading({ text = 'Loading…' }) {
  return <div className="center-screen muted">{text}</div>;
}

// Very small markdown: paragraphs, **bold**, links, images, line breaks.
export function Markdown({ text = '' }) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = esc(text)
    .replace(/!\[([^\]]*)\]\((https?:[^)\s]+)\)/g, '<img alt="$1" src="$2">')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .split(/\n{2,}/)
    .map((p) => (/^#{1,3} /.test(p) ? `<h3>${p.replace(/^#{1,3} /, '')}</h3>` : `<p>${p.replace(/\n/g, '<br>')}</p>`))
    .join('');
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Bar({ pct }) {
  return <div className="bar"><div style={{ width: `${Math.max(0, Math.min(100, pct || 0))}%` }} /></div>;
}
