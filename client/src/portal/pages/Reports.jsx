import { pledgesCsvUrl, useApi } from "../api";
import { ROLE_LABELS, formatINR, monthLabel } from "../format";
import { Empty, ErrorNote, Loading, PageHead } from "../ui";

export default function Reports() {
  const collections = useApi("/reports/collections");
  const activity = useApi("/reports/activity");
  const months = collections.data?.months ?? [];
  const peak = Math.max(1, ...months.map((m) => m.amount));

  return (
    <>
      <PageHead
        title="Reports"
        actions={
          <a className="pbtn pbtn-ghost" href={pledgesCsvUrl}>
            Download all pledges (CSV)
          </a>
        }
      />

      <section className="p-card">
        <h2>Collections by month</h2>
        <p className="p-muted">Payments recorded in the portal over the last 12 months.</p>
        <ErrorNote error={collections.error} />
        {!collections.data ? (
          collections.loading && <Loading />
        ) : !months.length ? (
          <Empty>No payments recorded yet.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="ptable">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Collected</th>
                  <th>Payments</th>
                  <th>Sevaks</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.month}>
                    <td>{monthLabel(m.month)}</td>
                    <td>
                      <div className="bar-cell">
                        <span className="bar" style={{ width: `${(m.amount / peak) * 100}%` }} />
                        <strong>{formatINR(m.amount)}</strong>
                      </div>
                    </td>
                    <td>{m.payments}</td>
                    <td>{m.sevaks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="p-card">
        <h2>Follow-up activity</h2>
        <p className="p-muted">Last 30 days, per devotee.</p>
        <ErrorNote error={activity.error} />
        {!activity.data ? (
          activity.loading && <Loading />
        ) : (
          <div className="table-wrap">
            <table className="ptable">
              <thead>
                <tr>
                  <th>Devotee</th>
                  <th>Follow-ups</th>
                  <th>Reached</th>
                  <th>No answer</th>
                  <th>Confirmed</th>
                </tr>
              </thead>
              <tbody>
                {activity.data.users.map((u) => (
                  <tr key={u.userId}>
                    <td>
                      {u.name}
                      <div className="p-muted">{ROLE_LABELS[u.role]}</div>
                    </td>
                    <td>{u.followups}</td>
                    <td>{u.reached}</td>
                    <td>{u.noAnswer}</td>
                    <td>{u.confirmed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
