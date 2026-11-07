import { useState } from "react";
import { ROLE_LABELS } from "../format";
import { PageHead } from "../ui";
import ChangePassword from "./ChangePassword";

export default function Account({ user, onUser }) {
  const [saved, setSaved] = useState(false);
  return (
    <>
      <PageHead title="Your account" sub={`${user.name} · ${user.email} · ${ROLE_LABELS[user.role]}`} />
      <section className="p-card p-narrow">
        <h2>Change password</h2>
        <p className="p-muted">Changing your password signs you out on every other device.</p>
        {saved && <p className="p-success" role="status">Password updated.</p>}
        <ChangePassword
          onDone={(u) => {
            setSaved(true);
            onUser(u);
          }}
        />
      </section>
    </>
  );
}
