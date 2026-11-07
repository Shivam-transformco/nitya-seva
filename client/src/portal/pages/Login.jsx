import { useState } from "react";
import { api } from "../api";
import { Brand, ErrorNote, Field } from "../ui";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      onLogin(await api("/auth/login", { method: "POST", body: { email: email.trim(), password } }));
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <Brand />
        <h1>Hare Krishna</h1>
        <p className="p-muted">Sign in to follow up with Nitya Sevaks.</p>
        <Field label="Email">
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <ErrorNote error={error} />
        <button className="pbtn pbtn-block" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="p-hint">Forgot your password? Ask an admin to reset it.</p>
      </form>
    </div>
  );
}
