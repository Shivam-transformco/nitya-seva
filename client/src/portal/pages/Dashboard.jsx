import { useApi } from "../api";
import { STATUSES, STATUS_LABELS, can, formatINR, monthLabel, plural } from "../format";
import { ThisMonth } from "../dues";
import { Link } from "../router";
import { ErrorNote, Loading, MaybeLink, PageHead } from "../ui";
import { PledgeRows } from "./Pledges";

export default function Dashboard({ user }) {
  const seesAll = can(user, "pledges.viewAll");
  const summary = useApi("/reports/summary");
  const recent = useApi(seesAll ? "/pledges?limit=5" : null);
  const s = summary.data;

  return (
    <>
      <PageHead title="Dashboard" sub="Where the Nitya Seva stands today." />
      <ErrorNote error={summary.error} />
      {!s ? (
        summary.loading && <Loading />
      ) : (
        <>
          <div className="stats">
            <div className="stat-card">
              <span className="p-label">Committed each month</span>
              <strong>{formatINR(s.committedMonthly)}</strong>
              <span className="p-muted">from {plural(s.statuses.confirmed.count, "confirmed sevak")}</span>
            </div>
            <div className="stat-card">
              <span className="p-label">Collected in {monthLabel(s.collectedThisMonth.month)}</span>
              <strong>{formatINR(s.collectedThisMonth.amount)}</strong>
              <span className="p-muted">{plural(s.collectedThisMonth.payments, "payment")} recorded</span>
            </div>
            <MaybeLink when={seesAll} to="/pledges?due=true" className={`stat-card${seesAll ? " stat-link" : ""}`}>
              <span className="p-label">Follow-ups due</span>
              <strong>{s.followupsDue}</strong>
              <span className="p-muted">by end of today</span>
            </MaybeLink>
            <MaybeLink when={seesAll} to="/pledges?assignedTo=none" className={`stat-card${seesAll ? " stat-link" : ""}`}>
              <span className="p-label">Waiting for a devotee</span>
              <strong>{s.unassigned}</strong>
              <span className="p-muted">new or contacted, not assigned</span>
            </MaybeLink>
          </div>

          <ThisMonth linked={seesAll} />

          <section className="p-card">
            <div className="p-card-head">
              <h2>Pledges by status</h2>
              {s.flagged > 0 && seesAll && <Link to="/pledges?flagged=true">{plural(s.flagged, "pledge")} marked not genuine</Link>}
            </div>
            <div className="status-strip">
              {STATUSES.map((st) => (
                <MaybeLink key={st} when={seesAll} to={`/pledges?status=${st}`} className={`status-cell badge-${st}`}>
                  <span>{STATUS_LABELS[st]}</span>
                  <strong>{s.statuses[st].count}</strong>
                  <small>{formatINR(s.statuses[st].amount)}/mo</small>
                </MaybeLink>
              ))}
            </div>
          </section>
        </>
      )}

      {seesAll && (
        <section className="p-card">
          <div className="p-card-head">
            <h2>Newest pledges</h2>
            <Link to="/pledges">See all</Link>
          </div>
          <ErrorNote error={recent.error} />
          {recent.data ? <PledgeRows items={recent.data.items} showAssignee /> : recent.loading && <Loading />}
        </section>
      )}
    </>
  );
}
