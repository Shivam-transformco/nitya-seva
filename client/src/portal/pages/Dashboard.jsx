import { useApi } from "../api";
import { STATUSES, STATUS_LABELS, formatINR, monthLabel, plural } from "../format";
import { Link } from "../router";
import { ErrorNote, Loading, PageHead } from "../ui";
import { PledgeRows } from "./Pledges";

export default function Dashboard() {
  const summary = useApi("/reports/summary");
  const recent = useApi("/pledges?limit=5");
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
            <Link to="/pledges?due=true" className="stat-card stat-link">
              <span className="p-label">Follow-ups due</span>
              <strong>{s.followupsDue}</strong>
              <span className="p-muted">by end of today</span>
            </Link>
            <Link to="/pledges?assignedTo=none" className="stat-card stat-link">
              <span className="p-label">Waiting for a devotee</span>
              <strong>{s.unassigned}</strong>
              <span className="p-muted">new or contacted, not assigned</span>
            </Link>
          </div>

          <section className="p-card">
            <div className="p-card-head">
              <h2>Pledges by status</h2>
              {s.flagged > 0 && <Link to="/pledges?flagged=true">{plural(s.flagged, "pledge")} marked not genuine</Link>}
            </div>
            <div className="status-strip">
              {STATUSES.map((st) => (
                <Link key={st} to={`/pledges?status=${st}`} className={`status-cell badge-${st}`}>
                  <span>{STATUS_LABELS[st]}</span>
                  <strong>{s.statuses[st].count}</strong>
                  <small>{formatINR(s.statuses[st].amount)}/mo</small>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}

      <section className="p-card">
        <div className="p-card-head">
          <h2>Newest pledges</h2>
          <Link to="/pledges">See all</Link>
        </div>
        <ErrorNote error={recent.error} />
        {recent.data ? <PledgeRows items={recent.data.items} showAssignee /> : recent.loading && <Loading />}
      </section>
    </>
  );
}
