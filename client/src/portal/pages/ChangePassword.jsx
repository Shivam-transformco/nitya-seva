import { useState } from "react";
import { api } from "../api";
import { ErrorNote, Field } from "../ui";

const MIN_LENGTH = 10;

export default function ChangePassword({ onDone }) {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (form.newPassword.length < MIN_LENGTH) return setError(new Error(`Use at least ${MIN_LENGTH} characters.`));
    if (form.newPassword !== form.confirm) return setError(new Error("The two new passwords don't match."));
    setBusy(true);
    try {
      const user = await api("/auth/password", {
        method: "POST",
        body: { currentPassword: form.currentPassword, newPassword: form.newPassword },
      });
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
      onDone(user);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="p-form" onSubmit={submit}>
      <Field label="Current password">
        <input type="password" autoComplete="current-password" required value={form.currentPassword} onChange={set("currentPassword")} />
      </Field>
      <Field label="New password" hint={`At least ${MIN_LENGTH} characters.`}>
        <input type="password" autoComplete="new-password" required value={form.newPassword} onChange={set("newPassword")} />
      </Field>
      <Field label="Confirm new password">
        <input type="password" autoComplete="new-password" required value={form.confirm} onChange={set("confirm")} />
      </Field>
      <ErrorNote error={error} />
      <button className="pbtn pbtn-block" disabled={busy}>
        {busy ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
