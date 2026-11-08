import { useState } from "react";
import { api, useApi } from "../api";
import { ROLE_LABELS, formatDateTime, manageableRoles, temporaryPassword } from "../format";
import { ErrorNote, Field, Loading, PageHead } from "../ui";

const ROLE_HINTS = {
  owner: "Everything an admin can do, plus managing admins, the activity log and permanent deletes.",
  admin: "Sees and works every pledge, assigns sevaks, runs the counter and adds staff below admin.",
  accounts: "Sees every pledge and records payments. Can't change statuses or assign sevaks.",
  viewer: "Sees the dashboard and reports only, with no sevak names or phone numbers.",
  followup: "Sees only the sevaks assigned to them.",
};

function RoleOptions({ roles }) {
  return roles.map((r) => (
    <option key={r} value={r}>
      {ROLE_LABELS[r]}
    </option>
  ));
}

function CredentialsNote({ creds, onClose }) {
  return (
    <div className="p-success creds" role="status">
      <p>
        Share these with <strong>{creds.name}</strong> privately. They'll be asked to choose their own password when they first sign in.
      </p>
      <dl className="facts">
        <dt>Portal</dt>
        <dd>{window.location.origin + window.location.pathname}</dd>
        <dt>Email</dt>
        <dd>{creds.email}</dd>
        <dt>Temporary password</dt>
        <dd>
          <code>{creds.password}</code>
        </dd>
      </dl>
      <button className="pbtn pbtn-ghost" onClick={onClose}>
        Done
      </button>
    </div>
  );
}

function AddStaff({ roles, onAdded }) {
  const blank = () => ({ name: "", email: "", role: "followup", temporaryPassword: temporaryPassword() });
  const [form, setForm] = useState(blank);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await api("/users", { method: "POST", body: { ...form, name: form.name.trim(), email: form.email.trim() } });
      onAdded({ name: user.name, email: user.email, password: form.temporaryPassword });
      setForm(blank());
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="p-card p-form" onSubmit={submit} aria-label="Add a staff member">
      <h2>Add a devotee</h2>
      <div className="p-grid-2">
        <Field label="Name">
          <input required value={form.name} onChange={set("name")} />
        </Field>
        <Field label="Email">
          <input type="email" required value={form.email} onChange={set("email")} />
        </Field>
        <Field label="Role" hint={ROLE_HINTS[form.role]}>
          <select value={form.role} onChange={set("role")}>
            <RoleOptions roles={roles} />
          </select>
        </Field>
        <Field label="Temporary password" hint="They'll change it on first sign-in.">
          <input required minLength={10} value={form.temporaryPassword} onChange={set("temporaryPassword")} />
        </Field>
      </div>
      <ErrorNote error={error} />
      <button className="pbtn" disabled={busy}>
        {busy ? "Adding…" : "Add devotee"}
      </button>
    </form>
  );
}

function StaffRow({ member, isSelf, roles, onChanged, onCredentials }) {
  const manageable = roles.includes(member.role);
  const [error, setError] = useState(null);

  async function patch(body) {
    setError(null);
    try {
      await api(`/users/${member._id}`, { method: "PATCH", body });
      onChanged();
      return true;
    } catch (err) {
      setError(err);
      return false;
    }
  }

  async function resetPassword() {
    if (!window.confirm(`Reset ${member.name}'s password? They'll be signed out everywhere.`)) return;
    const password = temporaryPassword();
    if (await patch({ resetPassword: password })) onCredentials({ name: member.name, email: member.email, password });
  }

  async function toggleActive() {
    if (member.active && !window.confirm(`Deactivate ${member.name}? They'll be signed out and can't sign in again.`)) return;
    await patch({ active: !member.active });
  }

  return (
    <tr className={member.active ? undefined : "inactive"}>
      <td>
        <strong>{member.name}</strong>
        {isSelf && <span className="p-muted"> (you)</span>}
        <div className="p-muted">{member.email}</div>
        <ErrorNote error={error} />
      </td>
      <td>
        {isSelf || !manageable ? (
          <span title={isSelf ? "You can't change your own role." : "Only an owner can change this."}>{ROLE_LABELS[member.role]}</span>
        ) : (
          <select aria-label={`Role for ${member.name}`} value={member.role} onChange={(e) => patch({ role: e.target.value })}>
            <RoleOptions roles={roles} />
          </select>
        )}
      </td>
      <td>
        {member.active ? (member.mustChangePassword ? "Invited" : "Active") : "Deactivated"}
        <div className="p-muted">{member.lastLoginAt ? `Last in ${formatDateTime(member.lastLoginAt)}` : "Never signed in"}</div>
      </td>
      <td className="actions">
        {(isSelf || manageable) && (
          <button className="pbtn pbtn-ghost pbtn-small" onClick={resetPassword}>
            Reset password
          </button>
        )}
        {!isSelf && manageable && (
          <button className="pbtn pbtn-ghost pbtn-small" onClick={toggleActive}>
            {member.active ? "Deactivate" : "Reactivate"}
          </button>
        )}
      </td>
    </tr>
  );
}

export default function Staff({ user }) {
  const { data, error, loading, reload } = useApi("/users");
  const [creds, setCreds] = useState(null);
  const roles = manageableRoles(user.role);

  return (
    <>
      <PageHead title="Staff" sub="Devotees who can sign in to the portal." />
      {creds && <CredentialsNote creds={creds} onClose={() => setCreds(null)} />}
      <section className="p-card p-card-flush">
        <ErrorNote error={error} />
        {!data ? (
          loading && <Loading />
        ) : (
          <div className="table-wrap">
            <table className="ptable">
              <thead>
                <tr>
                  <th>Devotee</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((m) => (
                  <StaffRow key={m._id} member={m} isSelf={m._id === user._id} roles={roles} onChanged={reload} onCredentials={setCreds} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <AddStaff
        roles={roles}
        onAdded={(c) => {
          setCreds(c);
          reload();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    </>
  );
}
