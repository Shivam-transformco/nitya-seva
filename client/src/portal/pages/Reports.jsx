import { pledgesCsvUrl, qs, useApi } from "../api";
import { MANDATE_LABELS, METHOD_LABELS, MODE_LABELS, ROLE_LABELS, can, formatINR, monthLabel, plural } from "../format";
import { Empty, ErrorNote, Loading, MaybeLink, PageHead } from "../ui";

function PaymentModes({ linked }) {
  const { data, error, loading } = useApi("/reports/payment-modes");
  return (
    <section className="p-card">
      <h2>How sevaks pay</h2>
      <p className="p-muted">Confirmed and paused pledges, by the payment mode recorded on each.</p>
      <ErrorNote error={error} />
      {!data ? (
        loading && <Loading />
      ) : !data.modes.length ? (
        <Empty>No confirmed pledges yet.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="ptable" aria-label="Pledges by payment mode">
            <thead>
              <tr>
                <th>Pays by</th>
                <th>Sevaks</th>
                <th>Monthly amount</th>
              </tr>
            </thead>
            <tbody>
              {data.modes.map((m) => (
                <tr key={`${m.mode}-${m.mandate}`}>
                  <td>
                    <MaybeLink when={linked} to={`/pledges${qs({ mode: m.mode ?? "none", mandate: m.mandate ?? "" })}`}>
                      {m.mode ? MODE_LABELS[m.mode] : "Not recorded"}
                    </MaybeLink>
                    {m.mandate && <div className="p-muted">Mandate: {MANDATE_LABELS[m.mandate].toLowerCase()}</div>}
                  </td>
                  <td>{m.count}</td>
                  <td>{formatINR(m.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="counter-sub">Collected by payment method</h3>
      <p className="p-muted">Payments recorded over the last 12 months.</p>
      {data &&
        (!data.methods.length ? (
          <Empty>No payments recorded yet.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="ptable" aria-label="Collections by payment method">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Payments</th>
                  <th>Collected</th>
                </tr>
              </thead>
              <tbody>
                {data.methods.map((m) => (
                  <tr key={m.method}>
                    <td>{METHOD_LABELS[m.method] ?? m.method}</td>
                    <td>{plural(m.payments, "payment")}</td>
                    <td>{formatINR(m.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </section>
  );
}

export default function Reports({ user }) {
  const collections = useApi("/reports/collections");
  const activity = useApi("/reports/activity");
  const months = collections.data?.months ?? [];
  const peak = Math.max(1, ...months.map((m) => m.amount));

  return (
    <>
      <PageHead
        title="Reports"
        actions={
          can(user, "reports.export") && (
            <a className="pbtn pbtn-ghost" href={pledgesCsvUrl}>
              Download all pledges (CSV)
            </a>
          )
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
            <table className="ptable" aria-label="Collections by month">
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

      <PaymentModes linked={can(user, "pledges.viewAll")} />

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
