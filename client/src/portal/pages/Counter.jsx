import { useState } from "react";
import { api, useApi } from "../api";
import { formatDate, formatINR, plural } from "../format";
import { Link } from "../router";
import { Empty, ErrorNote, Field, Loading, PageHead } from "../ui";

const signed = (n, fmt = String) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(-n)}` : fmt(0));
const signedINR = (n) => signed(n, formatINR);

function AdjustmentForm({ initial, submitLabel, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => ({
    label: initial?.label ?? "",
    amount: String(initial?.amount ?? ""),
    sevaks: String(initial?.sevaks ?? ""),
    note: initial?.note ?? "",
  }));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError(null);
    const amount = Number(form.amount || 0);
    const sevaks = Number(form.sevaks || 0);
    if (!Number.isInteger(amount) || !Number.isInteger(sevaks)) return setError(new Error("Use whole numbers."));
    if (!amount && !sevaks) return setError(new Error("Change the amount, the sevak count, or both."));
    setBusy(true);
    try {
      await onSubmit({ label: form.label.trim(), amount, sevaks, note: form.note.trim() });
      if (!initial) setForm({ label: "", amount: "", sevaks: "", note: "" });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="p-form" onSubmit={submit} aria-label={initial ? "Edit adjustment" : "Add an adjustment"}>
      <div className="p-grid-2">
        <Field label="Label" hint="Shown only here, e.g. “Offline sevaks before the website”.">
          <input required maxLength={100} value={form.label} onChange={set("label")} />
        </Field>
        <Field label="Note (optional)">
          <input maxLength={500} value={form.note} onChange={set("note")} />
        </Field>
        <Field label="Amount per month (₹)" hint="Use a minus sign to take an amount off.">
          <input type="number" step="1" inputMode="numeric" value={form.amount} onChange={set("amount")} placeholder="0" />
        </Field>
        <Field label="Sevaks" hint="Use a minus sign to take sevaks off.">
          <input type="number" step="1" inputMode="numeric" value={form.sevaks} onChange={set("sevaks")} placeholder="0" />
        </Field>
      </div>
      <ErrorNote error={error} />
      <div className="btn-row">
        <button className="pbtn" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="pbtn pbtn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function TargetCard({ target, updatedAt, onChanged }) {
  const [value, setValue] = useState(String(target));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const next = Number(value);
    if (!Number.isInteger(next) || next < 1) return setError(new Error("Enter a whole number of rupees above zero."));
    setBusy(true);
    try {
      await api("/counter/target", { method: "PUT", body: { target: next } });
      setSaved(true);
      onChanged();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="p-card">
      <h2>Monthly goal</h2>
      <p className="p-muted">
        The website shows “Raised of {formatINR(target)}” and fills the progress bar towards it.
        {updatedAt && ` Last changed ${formatDate(updatedAt)}.`}
      </p>
      <form className="p-form" onSubmit={submit} aria-label="Monthly goal">
        <Field label="Goal per month (₹)">
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            required
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setSaved(false);
            }}
          />
        </Field>
        <ErrorNote error={error} />
        <div className="btn-row">
          <button className="pbtn" disabled={busy || Number(value) === target}>
            {busy ? "Saving…" : "Save goal"}
          </button>
          {saved && <span className="p-muted" role="status">Saved.</span>}
        </div>
      </form>
    </section>
  );
}

function AdjustmentRow({ item, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(null);

  async function patch(body) {
    await api(`/counter/adjustments/${item._id}`, { method: "PATCH", body });
    onChanged();
  }

  async function run(fn) {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err);
    }
  }

  if (editing) {
    return (
      <li className="adj adj-editing">
        <AdjustmentForm
          initial={item}
          submitLabel="Save changes"
          onCancel={() => setEditing(false)}
          onSubmit={async (body) => {
            await patch(body);
            setEditing(false);
          }}
        />
      </li>
    );
  }

  return (
    <li className={`adj${item.active ? "" : " adj-off"}`}>
      <div className="adj-main">
        <strong>{item.label}</strong>
        <span className="p-muted">
          {item.active ? "Counting" : "Paused"} · added {formatDate(item.createdAt)}
          {item.note && ` · ${item.note}`}
        </span>
        <ErrorNote error={error} />
      </div>
      <div className="adj-values">
        <span>{signedINR(item.amount)}</span>
        <span className="p-muted">{signed(item.sevaks)} sevaks</span>
      </div>
      <div className="adj-actions">
        <button className="pbtn pbtn-ghost pbtn-small" onClick={() => run(() => patch({ active: !item.active }))}>
          {item.active ? "Pause" : "Resume"}
        </button>
        <button className="pbtn pbtn-ghost pbtn-small" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button
          className="pbtn pbtn-ghost pbtn-small"
          onClick={() =>
            window.confirm(`Delete “${item.label}”? Pausing keeps it for later.`) &&
            run(async () => {
              await api(`/counter/adjustments/${item._id}`, { method: "DELETE" });
              onChanged();
            })
          }
        >
          Delete
        </button>
      </div>
    </li>
  );
}

export default function Counter() {
  const { data: c, error, loading, reload } = useApi("/counter");

  return (
    <>
      <PageHead title="Public counter" sub="What the website shows, and how that number is made up." />
      <ErrorNote error={error} />
      {!c ? (
        loading && <Loading />
      ) : (
        <>
          <section className="p-card counter-hero">
            <span className="p-label">Shown on the website</span>
            <div className="counter-values">
              <strong data-testid="displayed-amount">{formatINR(c.displayed.amount)}</strong>
              <span>a month from</span>
              <strong data-testid="displayed-sevaks">{plural(c.displayed.sevaks, "sevak")}</strong>
            </div>
            <p className="p-muted" data-testid="goal-progress">
              {Math.min(100, Math.round((c.displayed.amount / c.target) * 100))}% of the {formatINR(c.target)} monthly goal
            </p>
            <p className="p-hint">The website can take up to a minute to show changes.</p>
          </section>

          <TargetCard target={c.target} updatedAt={c.targetUpdatedAt} onChanged={reload} />

          <section className="p-card">
            <h2>How it adds up</h2>
            <table className="ptable counter-table">
              <tbody>
                <tr>
                  <td>
                    Genuine pledges in progress
                    <div className="p-muted">{plural(c.counted.pledges, "pledge")}: new, contacted, confirmed or paused</div>
                  </td>
                  <td>{formatINR(c.counted.amount)}</td>
                  <td>{plural(c.counted.sevaks, "sevak")}</td>
                </tr>
                <tr>
                  <td>
                    Manual adjustments
                    <div className="p-muted">{plural(c.adjustments.items.filter((a) => a.active).length, "active entry", "active entries")}</div>
                  </td>
                  <td>{signedINR(c.adjustments.amount)}</td>
                  <td>{signed(c.adjustments.sevaks)}</td>
                </tr>
                <tr className="counter-total">
                  <td>Shown on the website</td>
                  <td>{formatINR(c.displayed.amount)}</td>
                  <td>{plural(c.displayed.sevaks, "sevak")}</td>
                </tr>
              </tbody>
            </table>
            <h3 className="counter-sub">Not counted</h3>
            <ul className="counter-excluded">
              <li>
                <Link to="/pledges?hidden=true">{plural(c.hidden.pledges, "pledge")} hidden from the counter</Link>
                <span className="p-muted"> · {formatINR(c.hidden.amount)} a month</span>
              </li>
              <li>
                <Link to="/pledges?flagged=true">{plural(c.flagged.pledges, "pledge")} marked as not genuine</Link>
                <span className="p-muted"> · {formatINR(c.flagged.amount)} a month</span>
              </li>
              <li className="p-muted">Lost and cancelled pledges are never counted.</li>
            </ul>
          </section>

          <section className="p-card">
            <h2>Manual adjustments</h2>
            <p className="p-muted">
              For sevaks who give outside the website, or to correct the total. Every change is recorded with your name.
            </p>
            {c.adjustments.items.length ? (
              <ul className="adj-list">
                {c.adjustments.items.map((a) => (
                  <AdjustmentRow key={a._id} item={a} onChanged={reload} />
                ))}
              </ul>
            ) : (
              <Empty>No adjustments. The website shows exactly the genuine pledges.</Empty>
            )}
          </section>

          <section className="p-card">
            <h2>Add an adjustment</h2>
            <AdjustmentForm
              submitLabel="Add adjustment"
              onSubmit={async (body) => {
                await api("/counter/adjustments", { method: "POST", body });
                reload();
              }}
            />
          </section>
        </>
      )}
    </>
  );
}
