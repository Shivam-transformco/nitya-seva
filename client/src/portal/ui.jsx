import { MANDATE_LABELS, MODE_SHORT, STATUS_LABELS } from "./format";
import { Link } from "./router";

export function Brand() {
  return (
    <Link to="/" className="brand">
      <img src="../images/ISKCON_logo_2.png" alt="" width="34" height="34" />
      <span>
        Nitya Seva <small>Staff portal</small>
      </span>
    </Link>
  );
}

export function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status] ?? status}</span>;
}

/** How the sevak pays, with the mandate state for auto-debits unless it's active. */
export function ModeBadge({ setup }) {
  if (!setup) return null;
  const status = setup.mandate?.status;
  const text = status && status !== "active" ? `${MODE_SHORT[setup.mode]} · ${MANDATE_LABELS[status]}` : MODE_SHORT[setup.mode];
  return <span className={`badge badge-mode badge-mode-${setup.mode}${status ? ` badge-mandate-${status}` : ""}`}>{text}</span>;
}

export function DueBadge({ due }) {
  return due ? <span className={`due due-${due.tone}`}>{due.text}</span> : null;
}

export function ErrorNote({ error }) {
  if (!error) return null;
  return (
    <p className="p-error" role="alert">
      {error.message ?? String(error)}
    </p>
  );
}

export function Loading({ label = "Loading…" }) {
  return <p className="p-muted p-loading">{label}</p>;
}

export function Empty({ children }) {
  return <p className="p-empty">{children}</p>;
}

export function Field({ label, hint, children, className = "" }) {
  return (
    <label className={`p-field ${className}`}>
      <span className="p-label">{label}</span>
      {children}
      {hint && <span className="p-hint">{hint}</span>}
    </label>
  );
}

export function PageHead({ title, sub, actions }) {
  return (
    <div className="p-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="p-muted">{sub}</p>}
      </div>
      {actions && <div className="p-head-actions">{actions}</div>}
    </div>
  );
}

export function Pager({ page, limit, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <nav className="p-pager" aria-label="Pages">
      <button className="pbtn pbtn-ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span className="p-muted">
        Page {page} of {pages}
      </span>
      <button className="pbtn pbtn-ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </nav>
  );
}
