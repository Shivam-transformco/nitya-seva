import { useState } from "react";
import { api, useApi } from "./api";
import { DUE_REASON_LABELS, DUE_STATE_LABELS, OWING_STATES, currentMonth, formatDate, formatINR, monthLabel, plural } from "./format";
import { Link } from "./router";
import { ErrorNote, Field, Loading, MaybeLink } from "./ui";

/** This month so far: expected from confirmed sevaks, received, still to come by its due day, and late. */
export function ThisMonth({ linked }) {
  const { data: t, error, loading } = useApi("/reports/this-month");
  const pct = (n) => (t?.expected ? `${Math.min(100, (n / t.expected) * 100)}%` : "0");
  const owing = t ? t.sevaks.overdue + t.sevaks.partial : 0;
  return (
    <section className="p-card">
      <div className="card-head">
        <h2>This month so far{t && ` · ${monthLabel(t.month)}`}</h2>
        {linked && t && (
          <Link to={`/reports/month/${t.month}`} className="pbtn pbtn-ghost pbtn-small">
            See each sevak
          </Link>
        )}
      </div>
      <ErrorNote error={error} />
      {!t ? (
        loading && <Loading />
      ) : (
        <>
          <div className="forecast">
            <div>
              <span className="p-muted">Expected</span>
              <strong>{formatINR(t.expected)}</strong>
            </div>
            <div>
              <span className="p-muted">Received</span>
              <strong>{formatINR(t.received)}</strong>
            </div>
            <div>
              <span className="p-muted">Still to come</span>
              <strong>{formatINR(t.stillToCome)}</strong>
              <small className="p-muted">{plural(t.sevaks.due, "sevak")}, not yet due</small>
            </div>
            <div className="late">
              <span className="p-muted">Overdue</span>
              <strong>{formatINR(t.overdue)}</strong>
              <small className="p-muted">
                <MaybeLink when={linked && owing > 0} to="/overdue">
                  {plural(owing, "sevak")} past their due day
                </MaybeLink>
              </small>
            </div>
          </div>
          <div className="month-bar" aria-hidden="true">
            <span className="got" style={{ width: pct(t.received) }} />
            <span className="late" style={{ width: pct(t.overdue) }} />
          </div>
        </>
      )}
    </section>
  );
}

/** Committed against collected, month by month. */
export function CommittedTable({ linked }) {
  const { data, error, loading } = useApi("/reports/dues");
  const months = [...(data?.months ?? [])].reverse();
  return (
    <section className="p-card">
      <h2>Committed and collected</h2>
      <p className="p-muted">
        What confirmed sevaks had pledged for each month, what they paid for it, and what's still owed. Paused sevaks aren't counted; excused months are
        shown apart.
      </p>
      <ErrorNote error={error} />
      {!data ? (
        loading && <Loading />
      ) : (
        <div className="table-wrap">
          <table className="ptable" aria-label="Committed and collected by month">
            <thead>
              <tr>
                <th>Month</th>
                <th className="num">Committed</th>
                <th className="num">Collected</th>
                <th className="num">Not paid</th>
                <th>Sevaks who didn't pay</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => {
                const short = m.sevaks.missed + m.sevaks.overdue + m.sevaks.partial;
                return (
                  <tr key={m.month}>
                    <td>
                      <MaybeLink when={linked} to={`/reports/month/${m.month}`}>
                        {monthLabel(m.month)}
                      </MaybeLink>
                    </td>
                    <td className="num">{formatINR(m.committed)}</td>
                    <td className="num">
                      {formatINR(m.collected)}
                      {m.committed > 0 && <div className="p-muted">{Math.round((m.collected / m.committed) * 100)}%</div>}
                    </td>
                    <td className={`num${m.outstanding ? " gap-cell" : ""}`}>
                      {formatINR(m.outstanding)}
                      {m.excused > 0 && <div className="p-muted">+ {formatINR(m.excused)} excused</div>}
                    </td>
                    <td>
                      {short ? plural(short, "sevak") : "—"}
                      {m.sevaks.due > 0 && <div className="p-muted">{m.sevaks.due} not yet due</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function DueStateBadge({ state }) {
  return <span className={`badge badge-due-${state}`}>{DUE_STATE_LABELS[state] ?? state}</span>;
}

/** "Travelling · back in May (excused) — Asha, 3 Apr 2026" */
export function NoteText({ note }) {
  if (!note) return null;
  return (
    <span className="due-note">
      {DUE_REASON_LABELS[note.reason]}
      {note.note && ` · ${note.note}`}
      {note.excused && " (excused)"}
      <span className="p-muted">
        {" "}
        — {note.byName}, {formatDate(note.at)}
      </span>
    </span>
  );
}

/** Why a month's gift didn't come. Saving again replaces the reason. */
export function ReasonForm({ pledgeId, month, note, onSaved, onCancel }) {
  const [form, setForm] = useState({ reason: note?.reason ?? "pay_later", note: note?.note ?? "", excused: note?.excused ?? false });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function send(method, body) {
    setError(null);
    setBusy(true);
    try {
      await api(`/pledges/${pledgeId}/dues/${month}`, { method, body });
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="reason-form"
      aria-label={`Reason for ${monthLabel(month)}`}
      onSubmit={(e) => {
        e.preventDefault();
        send("PUT", { ...form, note: form.note.trim() });
      }}
    >
      <div className="p-grid-2">
        <Field label="Why it didn't come">
          <select value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}>
            {Object.entries(DUE_REASON_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Note (optional)">
          <input maxLength={500} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
        </Field>
      </div>
      <label className="p-switch">
        <input type="checkbox" checked={form.excused} onChange={(e) => setForm((f) => ({ ...f, excused: e.target.checked }))} />
        Excuse this month (don't count it as missed)
      </label>
      <ErrorNote error={error} />
      <div className="btn-row">
        <button className="pbtn pbtn-small" disabled={busy}>
          {busy ? "Saving…" : "Save reason"}
        </button>
        {note && (
          <button type="button" className="pbtn pbtn-ghost pbtn-small" disabled={busy} onClick={() => send("DELETE")}>
            Remove reason
          </button>
        )}
        <button type="button" className="pbtn pbtn-ghost pbtn-small" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** "₹600 of ₹1,000" for part payments, the amount otherwise. */
export const paidText = (m) => (m.state === "partial" ? `${formatINR(m.paid)} of ${formatINR(m.expected)}` : m.paid ? formatINR(m.paid) : "—");

/** A pledge's gifts month by month, with reasons for the ones that didn't come. */
export function DuesCard({ pledge, canNote, onChanged }) {
  const dues = pledge.dues;
  const [open, setOpen] = useState(null);
  const [showAll, setShowAll] = useState(false);
  if (!dues) return null;
  const months = showAll ? dues.months : dues.months.slice(0, 6);
  const current = dues.months[0];
  const toCome =
    current?.month === currentMonth() && current.state === "due"
      ? `${monthLabel(current.month)}'s ${formatINR(current.expected - current.paid)} is still to come, due by day ${dues.dueDay}.`
      : "";

  return (
    <section className="p-card">
      <h2>Payments by month</h2>
      <p className="p-muted">
        {dues.missedInRow > 0
          ? `${dues.missedInRow} ${dues.missedInRow === 1 ? "gift" : "gifts in a row"} not paid · ${formatINR(dues.owed)} owed in the last 12 months. ${toCome}`
          : dues.unpaid.length
            ? `${dues.unpaid.map(monthLabel).join(", ")} not paid · ${formatINR(dues.owed)} owed in the last 12 months. ${toCome}`
            : toCome || "Up to date."}
      </p>
      <ul className="dues-list">
        {months.map((m) => (
          <li key={m.month} className={OWING_STATES.includes(m.state) ? "dues-owing" : undefined}>
            <div className="dues-row">
              <strong>{monthLabel(m.month)}</strong>
              <DueStateBadge state={m.state} />
              <span>{paidText(m)}</span>
              {canNote && m.state !== "paid" && open !== m.month && (
                <button type="button" className="pbtn pbtn-ghost pbtn-small" onClick={() => setOpen(m.month)}>
                  {m.note ? "Change reason" : "Add reason"}
                </button>
              )}
            </div>
            {open === m.month ? (
              <ReasonForm
                pledgeId={pledge._id}
                month={m.month}
                note={m.note}
                onCancel={() => setOpen(null)}
                onSaved={() => {
                  setOpen(null);
                  onChanged();
                }}
              />
            ) : (
              m.note && <NoteText note={m.note} />
            )}
          </li>
        ))}
      </ul>
      {dues.months.length > 6 && (
        <button type="button" className="pbtn pbtn-ghost pbtn-small" onClick={() => setShowAll((s) => !s)}>
          {showAll ? "Show fewer" : `Show all ${dues.months.length} months`}
        </button>
      )}
    </section>
  );
}
