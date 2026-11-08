import { useRef, useState } from "react";
import { api, useApi } from "../api";
import { FREQUENCIES, MANUAL_ORIGINS, ORIGIN_LABELS, STATUS_LABELS, currentMonth } from "../format";
import { Link, navigate } from "../router";
import { ErrorNote, Field, PageHead } from "../ui";

const DEFAULT_SEVA = "Prachar Sahyog Seva";
const STATUSES = ["new", "contacted", "confirmed", "paused"];
const ORIGIN_HINTS = {
  pre_website: "Already giving before the website. Usually confirmed, with past payments entered afterwards.",
  google_form: "Said they were willing in the Google Form campaign. Usually new, so someone follows up.",
  staff: "Offered in person or over the phone.",
};

const blank = (keep = {}) => ({
  name: "",
  phone: "",
  email: "",
  amount: "",
  frequency: keep.frequency ?? "Monthly",
  seva: keep.seva ?? DEFAULT_SEVA,
  message: "",
  origin: keep.origin ?? "google_form",
  status: keep.status ?? "new",
  givingSince: "",
  countOnCounter: keep.countOnCounter ?? true,
  assignedTo: keep.assignedTo ?? "",
});

/** Statuses a pledge typically starts with, by where it came from. */
const STATUS_FOR_ORIGIN = { pre_website: "confirmed", google_form: "new", staff: "new" };

export default function AddPledge() {
  const staff = useApi("/users");
  const [form, setForm] = useState(() => blank());
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(null);
  const another = useRef(false);
  const nameRef = useRef(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  function setOrigin(e) {
    const origin = e.target.value;
    setForm((f) => ({ ...f, origin, status: STATUS_FOR_ORIGIN[origin] }));
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setAdded(null);
    const amount = form.amount === "" ? 0 : Number(form.amount);
    if (!form.name.trim()) return setError(new Error("Enter their name."));
    if (!form.phone.trim()) return setError(new Error("Enter their phone number."));
    if (!Number.isInteger(amount) || amount < 0) return setError(new Error("Enter the amount in whole rupees, or leave it empty if not decided."));
    setBusy(true);
    try {
      const res = await api("/pledges", {
        method: "POST",
        body: {
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          amount,
          frequency: form.frequency,
          seva: form.seva.trim() || DEFAULT_SEVA,
          message: form.message.trim(),
          origin: form.origin,
          status: form.status,
          ...(form.givingSince && { givingSince: form.givingSince }),
          countOnCounter: form.countOnCounter,
          ...(form.assignedTo && { assignedTo: form.assignedTo }),
        },
      });
      if (!another.current) return navigate(`/pledges/${res.pledgeId}`);
      setAdded({ ...res, name: form.name.trim() });
      setForm(blank(form));
      nameRef.current?.focus();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const assignable = staff.data?.filter((u) => u.active && ["owner", "admin", "followup"].includes(u.role)) ?? [];

  return (
    <>
      <p className="crumbs">
        <Link to="/pledges">← All pledges</Link>
      </p>
      <PageHead title="Add a pledge" sub="For sevaks who didn't come through the website: earlier givers, Google Form responses, or offers made in person." />
      {added && (
        <p className="p-success" role="status">
          Added {added.name}.{" "}
          {added.existingSevak && `This phone number was already known as ${added.existingSevak.name}, so the pledge was added to them. `}
          <Link to={`/pledges/${added.pledgeId}`}>Open it</Link>
        </p>
      )}
      <form className="p-card p-form" onSubmit={submit} aria-label="Add a pledge" noValidate>
        <h2>Sevak</h2>
        <div className="p-grid-2">
          <Field label="Name">
            <input ref={nameRef} maxLength={100} required value={form.name} onChange={set("name")} />
          </Field>
          <Field label="Phone" hint="If this number is already known, the pledge joins that sevak.">
            <input type="tel" maxLength={30} required value={form.phone} onChange={set("phone")} />
          </Field>
          <Field label="Email (optional)">
            <input type="email" maxLength={200} value={form.email} onChange={set("email")} />
          </Field>
        </div>

        <h2>Pledge</h2>
        <div className="p-grid-2">
          <Field label="Came from" hint={ORIGIN_HINTS[form.origin]}>
            <select value={form.origin} onChange={setOrigin}>
              {MANUAL_ORIGINS.map((o) => (
                <option key={o} value={o}>
                  {ORIGIN_LABELS[o]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={set("status")}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount (₹)" hint="Leave empty if they haven't decided.">
            <input type="number" min="0" step="1" inputMode="numeric" value={form.amount} onChange={set("amount")} />
          </Field>
          <Field label="How often">
            <select value={form.frequency} onChange={set("frequency")}>
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Seva">
            <input maxLength={100} value={form.seva} onChange={set("seva")} />
          </Field>
          <Field label="Giving since (optional)" hint="The month they started, if before the portal.">
            <input type="month" max={currentMonth()} value={form.givingSince} onChange={set("givingSince")} />
          </Field>
          <Field label="Assign to (optional)">
            <select value={form.assignedTo} onChange={set("assignedTo")} disabled={!staff.data}>
              <option value="">Nobody yet</option>
              {assignable.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Notes (optional)">
          <textarea rows="3" maxLength={2000} value={form.message} onChange={set("message")} placeholder="e.g. their answer in the form" />
        </Field>
        <label className="p-switch">
          <input type="checkbox" checked={form.countOnCounter} onChange={set("countOnCounter")} />
          <span>Count this pledge on the website counter</span>
        </label>
        <ErrorNote error={error ?? staff.error} />
        <div className="btn-row">
          <button className="pbtn" disabled={busy} onClick={() => (another.current = false)}>
            {busy ? "Saving…" : "Save pledge"}
          </button>
          <button className="pbtn pbtn-ghost" disabled={busy} onClick={() => (another.current = true)}>
            Save and add another
          </button>
        </div>
        <p className="p-hint">
          “Save and add another” keeps where it came from, status, frequency, seva, assignee and the counter choice for the next one.
        </p>
      </form>
    </>
  );
}
