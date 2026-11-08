import { useEffect, useState } from "react";
import { api, onNotificationsChanged, onSessionEnded } from "./api";
import { ROLE_LABELS } from "./format";
import { Link, navigate, useRoute } from "./router";
import { Brand, Loading } from "./ui";
import Account from "./pages/Account";
import ChangePassword from "./pages/ChangePassword";
import Counter from "./pages/Counter";
import Dashboard from "./pages/Dashboard";
import Deleted from "./pages/Deleted";
import Login from "./pages/Login";
import Notifications from "./pages/Notifications";
import PledgeDetail from "./pages/PledgeDetail";
import Pledges from "./pages/Pledges";
import Reports from "./pages/Reports";
import Staff from "./pages/Staff";

const UNREAD_POLL_MS = 60_000;

export default function Portal() {
  // undefined while checking the session, null when logged out.
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    api("/auth/me").then(setUser, () => setUser(null));
    return onSessionEnded(() => setUser(null));
  }, []);

  if (user === undefined) return <Loading label="Opening the portal…" />;
  if (!user) return <Login onLogin={setUser} />;
  if (user.mustChangePassword) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <Brand />
          <h1>Choose your password</h1>
          <p className="p-muted">You signed in with a temporary password. Please set your own before continuing.</p>
          <ChangePassword onDone={setUser} />
        </div>
      </div>
    );
  }
  return <Shell user={user} onUser={setUser} />;
}

function useUnreadCount() {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const refresh = () => api("/notifications?unread=true&limit=1").then((d) => setUnread(d.unread), () => {});
    refresh();
    const timer = setInterval(() => document.visibilityState === "visible" && refresh(), UNREAD_POLL_MS);
    const off = onNotificationsChanged(refresh);
    return () => {
      clearInterval(timer);
      off();
    };
  }, []);
  return unread;
}

function Shell({ user, onUser }) {
  const { path, params } = useRoute();
  const unread = useUnreadCount();
  const isAdmin = user.role === "admin";

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    navigate("/");
    onUser(null);
  }

  const nav = [
    isAdmin && { to: "/", label: "Dashboard", match: (p) => p === "/" },
    { to: "/pledges", label: isAdmin ? "Pledges" : "My sevaks", match: (p) => p.startsWith("/pledges") || (!isAdmin && p === "/") },
    isAdmin && { to: "/staff", label: "Staff", match: (p) => p === "/staff" },
    isAdmin && { to: "/counter", label: "Counter", match: (p) => p === "/counter" },
    isAdmin && { to: "/reports", label: "Reports", match: (p) => p === "/reports" },
  ].filter(Boolean);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Brand />
          <nav className="mainnav" aria-label="Main">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} className={n.match(path) ? "active" : undefined}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="topbar-right">
            <Link to="/notifications" className={`bell${path === "/notifications" ? " active" : ""}`} aria-label={`Notifications, ${unread} unread`}>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path fill="currentColor" d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.84V3.5a1.5 1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z" />
              </svg>
              {unread > 0 && <span className="bell-count">{unread > 99 ? "99+" : unread}</span>}
            </Link>
            <details className="account">
              <summary>
                <span className="avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span>
                <span className="sr-only">Account menu</span>
              </summary>
              <div className="account-menu">
                <p>
                  <strong>{user.name}</strong>
                  <span className="p-muted">{ROLE_LABELS[user.role]}</span>
                </p>
                <Link to="/account" onClick={(e) => e.currentTarget.closest("details").removeAttribute("open")}>
                  Change password
                </Link>
                <button type="button" onClick={logout}>
                  Log out
                </button>
              </div>
            </details>
          </div>
        </div>
      </header>
      <main className="page">
        <Page path={path} params={params} user={user} onUser={onUser} />
      </main>
    </div>
  );
}

function Page({ path, params, user, onUser }) {
  const isAdmin = user.role === "admin";
  const pledgeId = path.match(/^\/pledges\/([a-f0-9]{24})$/i)?.[1];

  if (pledgeId) return <PledgeDetail id={pledgeId} user={user} />;
  if (path === "/" && isAdmin) return <Dashboard />;
  if (path === "/" || path === "/pledges") return <Pledges params={params} user={user} />;
  if (path === "/notifications") return <Notifications />;
  if (path === "/account") return <Account user={user} onUser={onUser} />;
  if (isAdmin && path === "/staff") return <Staff user={user} />;
  if (isAdmin && path === "/reports") return <Reports />;
  if (isAdmin && path === "/counter") return <Counter />;
  if (isAdmin && path === "/deleted") return <Deleted params={params} />;
  return (
    <div className="p-card">
      <h1>Page not found</h1>
      <p>
        <Link to="/">Go to the start page</Link>
      </p>
    </div>
  );
}
