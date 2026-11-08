import { useEffect, useState } from "react";
import { api, useApi } from "../api";
import {
  AUTO_DEBIT_MODES,
  CHANNEL_LABELS,
  FLAG_LABELS,
  MANDATE_LABELS,
  METHOD_LABELS,
  MODE_LABELS,
  OUTCOME_LABELS,
  STATUSES,
  STATUS_LABELS,
  currentMonth,
  defaultMethod,
  dueLabel,
  formatDate,
  formatDateTime,
  formatINR,
  monthLabel,
  plural,
  telLink,
  todayInput,
  waLink,
} from "../format";
import { Link, navigate } from "../router";
import { DueBadge, Empty, ErrorNote, Field, Loading, ModeBadge, StatusBadge } from "../ui";

const CAN_PAY = ["confirmed", "paused"];

export default function PledgeDetail({ id, user }) {
  const { data: p, error, loading, reload } = useApi(`/pledges/${id}`);
  const isAdmin = user.role === "admin";

  if (!p) return error ? <ErrorNote error={error} /> : loading && <Loading />;

  const firstName = p.sevak?.name.split(" ")[0] ?? "";
  const greeting = `Hare Krishna ${firstName}! This is ${user.name} from ISKCON BACE Jiasarai, about your Nitya Seva offering.`;

  return (
    <>
      <p className="crumbs">
        <Link to="/pledges">← {isAdmin ? "All pledges" : "My sevaks"}</Link>
      </p>
      <div className="detail-head">
        <div>
          <h1>{p.sevak?.name ?? "Unknown sevak"}</h1>
          <p className="detail-sub">
            <StatusBadge status={p.status} /> <ModeBadge setup={p.paymentSetup} /> <strong>{formatINR(p.amount)}</strong> a
            month · {p.seva}
          </p>
        </div>
        {p.sevak && (
          <div className="contact-actions">
            <a className="pbtn" href={telLink(p.sevak.phone)}>
              Call {p.sevak.phone}
            </a>
            <a className="pbtn pbtn-wa" href={waLink(p.sevak.phone, greeting)} target="_blank" rel="noopener">
              WhatsApp
            </a>
          </div>
        )}
      </div>

      {p.flag && (
        <div className="p-banner p-banner-flag" role="note">
          <strong>Marked as not genuine: {FLAG_LABELS[p.flag.reason]}.</strong> Left out of the counter, work lists and reports.
          <span className="p-muted">
            {" "}
            By {p.flag.byName} on {formatDate(p.flag.at)}
            {p.flag.note && ` · “${p.flag.note}”`}
          </span>
        </div>
      )}
      {!p.flag && p.hiddenFromCounter && (
        <div className="p-banner" role="note">
          <strong>Hidden from the public counter.</strong> Still followed up and included in reports.
        </div>
      )}

      <div className="detail-grid">
        <div className="detail-col">
          <DetailsCard pledge={p} onChanged={reload} />
          <StatusCard pledge={p} isAdmin={isAdmin} onChanged={reload} />
          {!p.flag && <PaymentSetupCard pledge={p} onChanged={reload} />}
          {isAdmin && <AssignCard pledge={p} onChanged={reload} />}
          {isAdmin && <CounterCard pledge={p} onChanged={reload} />}
          <FlagCard pledge={p} onChanged={reload} />
          {isAdmin && <DeleteCard pledge={p} onDeleted={() => navigate("/pledges")} />}
        </div>

        <div className="detail-col">
          <FollowupForm pledge={p} onSaved={reload} />
          {CAN_PAY.includes(p.status) && !p.flag ? (
            <PaymentForm key={p.paymentSetup?.mode ?? "none"} pledge={p} onSaved={reload} />
          ) : (
            <section className="p-card p-card-quiet">
              <h2>Record a payment</h2>
              <p className="p-muted">
                {p.flag
                  ? "This pledge is marked as not genuine, so payments can't be recorded."
                  : "Payments can be recorded once the seva is confirmed."}
              </p>
            </section>
          )}
          <History pledge={p} user={user} onChanged={reload} />
        </div>
      </div>
    </>
  );
}

/** Value for <input type="datetime-local"> in the browser's timezone. */
function localInput(d) {
  if (!d) return "";
  const date = new Date(d);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

const detailsForm = (p) => ({
  name: p.sevak?.name ?? "",
  phone: p.sevak?.phone ?? "",
  email: p.sevak?.email ?? "",
  amount: String(p.amount),
  seva: p.seva,
  message: p.message ?? "",
  nextFollowUpAt: localInput(p.nextFollowUpAt),
});

const CLOSED = ["lost", "cancelled"];

function DetailsCard({ pledge: p, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => detailsForm(p));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError(null);
    const was = detailsForm(p);
    const amount = Number(form.amount);
    if (!Number.isInteger(amount) || amount < 1) return setError(new Error("Enter the amount in whole rupees."));
    if (!form.name.trim()) return setError(new Error("Enter their name."));

    const sevak = {};
    for (const k of ["name", "phone", "email"]) if (form[k].trim() !== was[k]) sevak[k] = form[k].trim();
    const pledge = {};
    if (amount !== p.amount) pledge.amount = amount;
    if (form.seva.trim() !== was.seva) pledge.seva = form.seva.trim();
    if (form.message.trim() !== was.message.trim()) pledge.message = form.message.trim();
    if (form.nextFollowUpAt !== was.nextFollowUpAt) {
      pledge.nextFollowUpAt = form.nextFollowUpAt ? new Date(form.nextFollowUpAt).toISOString() : null;
    }

    setBusy(true);
    try {
      if (Object.keys(sevak).length) await api(`/pledges/${p._id}/sevak`, { method: "PATCH", body: sevak });
      if (Object.keys(pledge).length) await api(`/pledges/${p._id}`, { method: "PATCH", body: pledge });
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <form className="p-card p-form" onSubmit={submit} aria-label="Edit details" noValidate>
        <h2>Edit details</h2>
        <div className="p-grid-2">
          <Field label="Name">
            <input maxLength={100} required value={form.name} onChange={set("name")} />
          </Field>
          <Field label="Phone">
            <input type="tel" maxLength={30} required value={form.phone} onChange={set("phone")} />
          </Field>
          <Field label="Email (optional)">
            <input type="email" maxLength={200} value={form.email} onChange={set("email")} />
          </Field>
          <Field label="Amount a month (₹)">
            <input type="number" min="1" step="1" inputMode="numeric" required value={form.amount} onChange={set("amount")} />
          </Field>
          <Field label="Seva">
            <input maxLength={100} required value={form.seva} onChange={set("seva")} />
          </Field>
          {!CLOSED.includes(p.status) && (
            <Field label="Next follow-up" hint="Leave empty for none.">
              <input type="datetime-local" value={form.nextFollowUpAt} onChange={set("nextFollowUpAt")} />
            </Field>
          )}
        </div>
        <Field label="Their message">
          <textarea rows="3" maxLength={2000} value={form.message} onChange={set("message")} />
        </Field>
        <p className="p-hint">Name, phone and email change on all of this sevak's pledges.</p>
        <ErrorNote error={error} />
        <div className="btn-row">
          <button className="pbtn" disabled={busy}>
            {busy ? "Saving…" : "Save details"}
          </button>
          <button type="button" className="pbtn pbtn-ghost" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <section className="p-card">
      <div className="card-head">
        <h2>Details</h2>
        <button
          type="button"
          className="pbtn pbtn-ghost pbtn-small"
          onClick={() => {
            setForm(detailsForm(p));
            setError(null);
            setEditing(true);
          }}
        >
          Edit
        </button>
      </div>
      <dl className="facts">
        <dt>Phone</dt>
        <dd>{p.sevak?.phone ?? "—"}</dd>
        <dt>Email</dt>
        <dd>{p.sevak?.email ? <a href={`mailto:${p.sevak.email}`}>{p.sevak.email}</a> : "—"}</dd>
        <dt>Pledged on</dt>
        <dd>{formatDate(p.createdAt)}</dd>
        <dt>Last contact</dt>
        <dd>{formatDateTime(p.lastContactAt)}</dd>
        <dt>Next follow-up</dt>
        <dd>{p.nextFollowUpAt && !p.flag ? <DueBadge due={dueLabel(p.nextFollowUpAt)} /> : "None scheduled"}</dd>
        <dt>Assigned to</dt>
        <dd>{p.assignee?.name ?? "Nobody yet"}</dd>
      </dl>
      {p.message && (
        <blockquote className="sevak-message">
          <span className="p-label">Their message</span>
          {p.message}
        </blockquote>
      )}
    </section>
  );
}

function DeleteCard({ pledge, onDeleted }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const count = pledge.followups.length + pledge.payments.length;

  async function remove() {
    const what = count ? ` and its ${plural(pledge.followups.length, "follow-up")} and ${plural(pledge.payments.length, "payment")}` : "";
    if (!window.confirm(`Delete this pledge${what}? You can restore it from Recently deleted.`)) return;
    setError(null);
    setBusy(true);
    try {
      await api(`/pledges/${pledge._id}`, { method: "DELETE", body: { reason: reason.trim() } });
      onDeleted();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <section className="p-card p-card-danger">
      <h2>Delete pledge</h2>
      <p className="p-muted">
        Removes it from every list, report and the counter, with its follow-ups and payments. It goes to{" "}
        <Link to="/deleted">Recently deleted</Link>, where an admin can restore it. For spam or duplicates, marking it as not
        genuine is usually enough.
      </p>
      <Field label="Reason (optional)">
        <input maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. entered twice by mistake" />
      </Field>
      <ErrorNote error={error} />
      <button type="button" className="pbtn pbtn-danger" disabled={busy} onClick={remove}>
        {busy ? "Deleting…" : "Delete pledge"}
      </button>
    </section>
  );
}

function StatusCard({ pledge, isAdmin, onChanged }) {
  const [note, setNote] = useState("");
  const [correctTo, setCorrectTo] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const change = pledge.lastStatusChange;

  async function run(request) {
    setError(null);
    setBusy(true);
    try {
      await request();
      setNote("");
      setCorrectTo("");
      onChanged();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const setStatus = (status, correction = false) =>
    run(() =>
      api(`/pledges/${pledge._id}/status`, { method: "PATCH", body: { status, note: note.trim() || undefined, correction } }),
    );

  return (
    <section className="p-card">
      <h2>Status</h2>
      {pledge.undoTo && change && (
        <div className="undo-note" role="status">
          <span>
            Changed from <strong>{STATUS_LABELS[change.from]}</strong> to <strong>{STATUS_LABELS[change.to]}</strong> by{" "}
            {change.byName}, {formatDateTime(change.at)}.
          </span>
          <button
            type="button"
            className="pbtn pbtn-ghost pbtn-small"
            disabled={busy}
            onClick={() => run(() => api(`/pledges/${pledge._id}/status/undo`, { method: "POST" }))}
          >
            Undo · back to {STATUS_LABELS[pledge.undoTo].toLowerCase()}
          </button>
        </div>
      )}
      <p className="p-muted">
        Logging a follow-up updates the status for you. Use these for anything else.
      </p>
      <Field label="Reason (optional)">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. travelling for two months" />
      </Field>
      <div className="btn-row">
        {pledge.allowedNextStatuses.map((s) => (
          <button key={s} type="button" className="pbtn pbtn-ghost" disabled={busy} onClick={() => setStatus(s)}>
            Mark {STATUS_LABELS[s].toLowerCase()}
          </button>
        ))}
      </div>
      {isAdmin && (
        <details className="p-more">
          <summary>Correct the status</summary>
          <p className="p-hint">For putting a mistake right: sets any status, outside the usual steps.</p>
          <div className="btn-row">
            <select aria-label="Correct status to" value={correctTo} onChange={(e) => setCorrectTo(e.target.value)}>
              <option value="">Choose a status</option>
              {STATUSES.filter((s) => s !== pledge.status).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <button type="button" className="pbtn pbtn-ghost" disabled={busy || !correctTo} onClick={() => setStatus(correctTo, true)}>
              Set status
            </button>
          </div>
        </details>
      )}
      <ErrorNote error={error} />
    </section>
  );
}

const setupForm = (setup) => ({
  mode: setup?.mode ?? "",
  status: setup?.mandate?.status ?? "submitted",
  bank: setup?.mandate?.bank ?? "",
  reference: setup?.mandate?.reference ?? "",
  debitDay: setup?.mandate?.debitDay ? String(setup.mandate.debitDay) : "",
  startMonth: setup?.mandate?.startMonth ?? "",
  note: setup?.note ?? "",
});

function PaymentSetupCard({ pledge, onChanged }) {
  const setup = pledge.paymentSetup;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => setupForm(setup));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const auto = AUTO_DEBIT_MODES.includes(form.mode);

  async function run(request) {
    setError(null);
    setBusy(true);
    try {
      await request();
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  function submit(e) {
    e.preventDefault();
    if (!form.mode) return setError(new Error("Choose how they pay."));
    const debitDay = form.debitDay ? Number(form.debitDay) : undefined;
    if (debitDay !== undefined && !(Number.isInteger(debitDay) && debitDay >= 1 && debitDay <= 31)) {
      return setError(new Error("Debit day is a date of the month, 1 to 31."));
    }
    const body = {
      mode: form.mode,
      note: form.note.trim(),
      ...(auto && {
        mandate: {
          status: form.status,
          bank: form.bank.trim(),
          reference: form.reference.trim(),
          ...(debitDay && { debitDay }),
          ...(form.startMonth && { startMonth: form.startMonth }),
        },
      }),
    };
    run(() => api(`/pledges/${pledge._id}/payment-setup`, { method: "PUT", body }));
  }

  if (setup && !editing) {
    const m = setup.mandate;
    return (
      <section className="p-card">
        <h2>How they pay</h2>
        <dl className="facts">
          <dt>Pays by</dt>
          <dd>{MODE_LABELS[setup.mode]}</dd>
          {m && (
            <>
              <dt>Mandate</dt>
              <dd>
                <span className={`badge badge-mandate-${m.status}`}>{MANDATE_LABELS[m.status]}</span>
              </dd>
              <dt>Bank</dt>
              <dd>{m.bank || "—"}</dd>
              <dt>Reference / UMRN</dt>
              <dd>{m.reference || "—"}</dd>
              <dt>Debit day</dt>
              <dd>{m.debitDay ? `${m.debitDay} of each month` : "—"}</dd>
              <dt>Starts</dt>
              <dd>{m.startMonth ? monthLabel(m.startMonth) : "—"}</dd>
            </>
          )}
          {setup.note && (
            <>
              <dt>Note</dt>
              <dd>{setup.note}</dd>
            </>
          )}
        </dl>
        <p className="p-hint">
          Updated by {setup.updatedByName} on {formatDate(setup.updatedAt)}.
        </p>
        <div className="btn-row">
          <button
            type="button"
            className="pbtn pbtn-ghost"
            onClick={() => {
              setForm(setupForm(setup));
              setEditing(true);
            }}
          >
            Change
          </button>
        </div>
      </section>
    );
  }

  return (
    <form className="p-card p-form" onSubmit={submit} aria-label="How they pay" noValidate>
      <h2>How they pay</h2>
      {!setup && <p className="p-muted">Not recorded yet. Note it once they've chosen, e.g. after filling the ECS form.</p>}
      <fieldset className="p-field">
        <legend className="p-label">Pays by</legend>
        <div className="choice-chips">
          {Object.entries(MODE_LABELS).map(([v, l]) => (
            <label key={v} className={`choice${form.mode === v ? " on" : ""}`}>
              <input type="radio" name="mode" value={v} checked={form.mode === v} onChange={set("mode")} />
              {l}
            </label>
          ))}
        </div>
      </fieldset>
      {auto && (
        <div className="p-grid-2">
          <Field label="Mandate status">
            <select value={form.status} onChange={set("status")}>
              {Object.entries(MANDATE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Bank (optional)">
            <input maxLength={100} value={form.bank} onChange={set("bank")} placeholder="e.g. SBI" />
          </Field>
          <Field label="Reference / UMRN (optional)" hint="Don't enter account numbers.">
            <input maxLength={100} value={form.reference} onChange={set("reference")} />
          </Field>
          <Field label="Debit day (optional)">
            <input type="number" min="1" max="31" step="1" inputMode="numeric" value={form.debitDay} onChange={set("debitDay")} placeholder="e.g. 5" />
          </Field>
          <Field label="First debit month (optional)">
            <input type="month" value={form.startMonth} onChange={set("startMonth")} />
          </Field>
        </div>
      )}
      <Field label="Note (optional)">
        <input maxLength={500} value={form.note} onChange={set("note")} />
      </Field>
      <ErrorNote error={error} />
      <div className="btn-row">
        <button className="pbtn" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        {setup && (
          <>
            <button type="button" className="pbtn pbtn-ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="pbtn pbtn-ghost"
              disabled={busy}
              onClick={() => run(() => api(`/pledges/${pledge._id}/payment-setup`, { method: "DELETE" }))}
            >
              Clear
            </button>
          </>
        )}
      </div>
    </form>
  );
}

function AssignCard({ pledge, onChanged }) {
  const staff = useApi("/users");
  const [error, setError] = useState(null);

  async function assign(userId) {
    setError(null);
    try {
      await api(`/pledges/${pledge._id}/assign`, { method: "PATCH", body: { userId: userId || null } });
      onChanged();
    } catch (err) {
      setError(err);
    }
  }

  const active = staff.data?.filter((u) => u.active || u._id === pledge.assignedTo) ?? [];
  return (
    <section className="p-card">
      <h2>Assign</h2>
      <Field label="Devotee who will follow up">
        <select value={pledge.assignedTo ?? ""} onChange={(e) => assign(e.target.value)} disabled={!staff.data}>
          <option value="">Nobody</option>
          {active.map((u) => (
            <option key={u._id} value={u._id}>
              {u.name}
            </option>
          ))}
        </select>
      </Field>
      <ErrorNote error={error ?? staff.error} />
    </section>
  );
}

function CounterCard({ pledge, onChanged }) {
  const [error, setError] = useState(null);
  // Shown straight away; cleared once the reloaded pledge reflects it (or the save fails).
  const [pending, setPending] = useState(null);
  useEffect(() => setPending(null), [pledge.hiddenFromCounter]);
  const counted = pending ?? !pledge.hiddenFromCounter;

  async function toggle(e) {
    const next = e.target.checked;
    setError(null);
    setPending(next);
    try {
      await api(`/pledges/${pledge._id}/counter`, { method: "PATCH", body: { hidden: !next } });
      onChanged();
    } catch (err) {
      setPending(null);
      setError(err);
    }
  }

  return (
    <section className="p-card">
      <h2>Public counter</h2>
      <label className="p-switch">
        <input
          type="checkbox"
          checked={counted && !pledge.flag}
          disabled={pending !== null || Boolean(pledge.flag)}
          onChange={toggle}
        />
        <span>Count this pledge on the website counter</span>
      </label>
      <p className="p-hint">
        {pledge.flag
          ? "Not counted while it's marked as not genuine."
          : "Turn off to keep a genuine pledge off the public total. It stays in follow-ups and reports."}
      </p>
      <ErrorNote error={error} />
    </section>
  );
}

function FlagCard({ pledge, onChanged }) {
  const [reason, setReason] = useState("spam");
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function run(request) {
    setError(null);
    setBusy(true);
    try {
      await request();
      setNote("");
      onChanged();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (pledge.flag) {
    return (
      <section className="p-card">
        <h2>Not genuine</h2>
        <p className="p-muted">If this was a mistake, remove the mark to bring the pledge back.</p>
        <button
          type="button"
          className="pbtn pbtn-ghost"
          disabled={busy}
          onClick={() => run(() => api(`/pledges/${pledge._id}/flag`, { method: "DELETE" }))}
        >
          Remove the mark
        </button>
        <ErrorNote error={error} />
      </section>
    );
  }

  return (
    <form
      className="p-card p-form"
      aria-label="Mark as not genuine"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => api(`/pledges/${pledge._id}/flag`, { method: "PUT", body: { reason, note: note.trim() } }));
      }}
    >
      <h2>Not a real pledge?</h2>
      <p className="p-muted">Spam, a test or a duplicate. It will be left out of the counter, work lists and reports.</p>
      <div className="p-grid-2">
        <Field label="Reason">
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            {Object.entries(FLAG_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Note (optional)">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. number doesn't exist" />
        </Field>
      </div>
      <ErrorNote error={error} />
      <button className="pbtn pbtn-ghost" disabled={busy}>
        Mark as not genuine
      </button>
    </form>
  );
}

const EMPTY_FOLLOWUP = { channel: "call", outcome: "", note: "", nextFollowUpAt: "" };

function FollowupForm({ pledge, onSaved }) {
  const [form, setForm] = useState(EMPTY_FOLLOWUP);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const needsDate = form.outcome === "callback";

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setSaved(null);
    if (!form.outcome) return setError(new Error("Choose how it went."));
    if (needsDate && !form.nextFollowUpAt) return setError(new Error("Choose when to call back."));
    setBusy(true);
    try {
      const res = await api(`/pledges/${pledge._id}/followups`, {
        method: "POST",
        body: {
          channel: form.channel,
          outcome: form.outcome,
          note: form.note.trim(),
          nextFollowUpAt: form.nextFollowUpAt ? new Date(form.nextFollowUpAt).toISOString() : undefined,
        },
      });
      setForm(EMPTY_FOLLOWUP);
      setSaved(
        res.pledgeStatus !== pledge.status
          ? `Saved. The pledge is now ${STATUS_LABELS[res.pledgeStatus].toLowerCase()}.`
          : "Saved.",
      );
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="p-card p-form" onSubmit={submit} aria-label="Log a follow-up" noValidate>
      <h2>Log a follow-up</h2>
      <Field label="How did you reach out?">
        <select value={form.channel} onChange={set("channel")}>
          {Object.entries(CHANNEL_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <fieldset className="p-field">
        <legend className="p-label">How did it go?</legend>
        <div className="choice-chips">
          {Object.entries(OUTCOME_LABELS).map(([v, l]) => (
            <label key={v} className={`choice${form.outcome === v ? " on" : ""}`}>
              <input type="radio" name="outcome" value={v} checked={form.outcome === v} onChange={set("outcome")} />
              {l}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Notes">
        <textarea rows="3" value={form.note} onChange={set("note")} placeholder="What did you talk about?" />
      </Field>
      <Field label={needsDate ? "Call back on" : "Next follow-up (optional)"}>
        <input type="datetime-local" value={form.nextFollowUpAt} onChange={set("nextFollowUpAt")} required={needsDate} />
      </Field>
      <ErrorNote error={error} />
      {saved && <p className="p-success" role="status">{saved}</p>}
      <button className="pbtn" disabled={busy}>
        {busy ? "Saving…" : "Save follow-up"}
      </button>
    </form>
  );
}

// A bare "YYYY-MM-DD" is read as UTC midnight (05:30 IST), which the server rejects as "in the future"
// early in the morning, so send a full timestamp.
function receivedAtFromInput(date) {
  if (!date || date === todayInput()) return new Date().toISOString();
  return new Date(`${date}T12:00:00+05:30`).toISOString();
}

function PaymentForm({ pledge, onSaved }) {
  const blank = () => ({
    amount: String(pledge.amount),
    month: currentMonth(),
    method: defaultMethod(pledge.paymentSetup),
    reference: "",
    receivedAt: todayInput(),
  });
  const [form, setForm] = useState(blank);
  const [error, setError] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setReceipt(null);
    const amount = Number(form.amount);
    if (!Number.isInteger(amount) || amount < 1) return setError(new Error("Enter the amount in whole rupees."));
    setBusy(true);
    try {
      const payment = await api(`/pledges/${pledge._id}/payments`, {
        method: "POST",
        body: {
          amount,
          month: form.month,
          method: form.method,
          reference: form.reference.trim(),
          receivedAt: receivedAtFromInput(form.receivedAt),
        },
      });
      setReceipt(payment);
      setForm(blank());
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="p-card p-form" onSubmit={submit} aria-label="Record a payment">
      <h2>Record a payment</h2>
      <div className="p-grid-2">
        <Field label="Amount (₹)">
          <input type="number" min="1" step="1" inputMode="numeric" required value={form.amount} onChange={set("amount")} />
        </Field>
        <Field label="For the month of">
          <input type="month" required value={form.month} onChange={set("month")} />
        </Field>
        <Field label="Paid by">
          <select value={form.method} onChange={set("method")}>
            {Object.entries(METHOD_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Received on">
          <input type="date" max={todayInput()} value={form.receivedAt} onChange={set("receivedAt")} />
        </Field>
      </div>
      <Field label="Reference (optional)" hint="UPI transaction ID, cheque number, or the ECS entry on the bank statement…">
        <input value={form.reference} onChange={set("reference")} />
      </Field>
      <ErrorNote error={error} />
      {receipt && (
        <p className="p-success" role="status">
          Recorded {formatINR(receipt.amount)} for {monthLabel(receipt.month)}. Receipt <strong>{receipt.receiptNo}</strong>.
        </p>
      )}
      <button className="pbtn" disabled={busy}>
        {busy ? "Saving…" : "Record payment"}
      </button>
    </form>
  );
}

function History({ pledge, user, onChanged }) {
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const isAdmin = user.role === "admin";
  const events = [
    ...pledge.followups.map((f) => ({ kind: "followup", at: f.createdAt, item: f, mine: f.byUserId === user._id })),
    ...pledge.payments.map((pay) => ({ kind: "payment", at: pay.createdAt, item: pay, mine: pay.recordedBy === user._id })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));

  async function remove(kind, item) {
    const question =
      kind === "payment"
        ? `Delete the ${formatINR(item.amount)} payment for ${monthLabel(item.month)} (receipt ${item.receiptNo})? Its receipt number won't be reused.`
        : "Delete this follow-up? If it was the latest one, the pledge's status and dates go back to how they were before it.";
    if (!window.confirm(`${question}${isAdmin ? " You can restore it from Recently deleted." : ""}`)) return;
    setError(null);
    setBusyId(item._id);
    try {
      await api(`/pledges/${pledge._id}/${kind === "payment" ? "payments" : "followups"}/${item._id}`, { method: "DELETE" });
      onChanged();
    } catch (err) {
      setError(err);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="p-card">
      <h2>History</h2>
      <ErrorNote error={error} />
      {!events.length ? (
        <Empty>No follow-ups or payments yet.</Empty>
      ) : (
        <ol className="timeline">
          {events.map(({ kind, at, item, mine }) => (
            <li key={item._id} className={`tl-${kind}`}>
              <span className="tl-when">
                {formatDateTime(at)}
                {(isAdmin || mine) && (
                  <button
                    type="button"
                    className="tl-delete"
                    disabled={busyId === item._id}
                    onClick={() => remove(kind, item)}
                    aria-label={kind === "payment" ? `Delete payment ${item.receiptNo}` : "Delete this follow-up"}
                  >
                    Delete
                  </button>
                )}
              </span>
              {kind === "followup" ? (
                <>
                  <strong>
                    {CHANNEL_LABELS[item.channel]} · {OUTCOME_LABELS[item.outcome]}
                  </strong>
                  {item.note && <p>{item.note}</p>}
                  {item.nextFollowUpAt && <span className="p-muted">Next: {formatDateTime(item.nextFollowUpAt)}</span>}
                </>
              ) : (
                <>
                  <strong>
                    Payment {formatINR(item.amount)} for {monthLabel(item.month)}
                  </strong>
                  <span className="p-muted">
                    {METHOD_LABELS[item.method]}
                    {item.reference && ` · ${item.reference}`} · Receipt {item.receiptNo}
                  </span>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
