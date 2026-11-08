import { useState } from "react";
import { useApi } from "../api";
import { DueStateBadge, NoteText, ReasonForm, paidText } from "../dues";
import { MODE_SHORT, OWING_STATES, addMonthsTo, currentMonth, formatINR, monthLabel, perLabel, plural } from "../format";
import { Link } from "../router";
import { Empty, ErrorNote, Loading, PageHead } from "../ui";

/** Every sevak with a gift due in one month: who paid, who didn't and why. */
export default function DuesMonth({ month }) {
  const { data, error, loading, reload } = useApi(`/dues/month/${month}`);
  const [open, setOpen] = useState(null);
  const t = data?.totals;
  const next = addMonthsTo(month, 1);

  return (
    <>
      <p className="crumbs">
        <Link to="/reports">← Reports</Link>
      </p>
      <PageHead
        title={monthLabel(month)}
        sub="Every sevak with a gift due this month. The ones still owing are at the top."
        actions={
          <>
            <Link className="pbtn pbtn-ghost pbtn-small" to={`/reports/month/${addMonthsTo(month, -1)}`}>
              ← {monthLabel(addMonthsTo(month, -1))}
            </Link>
            {next <= currentMonth() && (
              <Link className="pbtn pbtn-ghost pbtn-small" to={`/reports/month/${next}`}>
                {monthLabel(next)} →
              </Link>
            )}
          </>
        }
      />
      <ErrorNote error={error} />
      {!data ? (
        loading && <Loading />
      ) : (
        <>
          <section className="p-card">
            <div className="forecast">
              <div>
                <span className="p-muted">Committed</span>
                <strong>{formatINR(t.committed)}</strong>
              </div>
              <div>
                <span className="p-muted">Collected</span>
                <strong>{formatINR(t.collected)}</strong>
              </div>
              <div className="late">
                <span className="p-muted">Not paid</span>
                <strong>{formatINR(t.outstanding)}</strong>
                <small className="p-muted">{plural(t.sevaks.missed + t.sevaks.overdue + t.sevaks.partial, "sevak")}</small>
              </div>
              {t.excused > 0 && (
                <div>
                  <span className="p-muted">Excused</span>
                  <strong>{formatINR(t.excused)}</strong>
                </div>
              )}
            </div>
          </section>

          <section className="p-card p-card-flush">
            {!data.rows.length ? (
              <Empty>Nothing was due this month.</Empty>
            ) : (
              <ul className="rows">
                {data.rows.map((r) => (
                  <li key={r.pledgeId} className={`due-month-row${OWING_STATES.includes(r.state) ? " dues-owing" : ""}`}>
                    <div className="row row-static">
                      <span className="row-main">
                        <Link to={`/pledges/${r.pledgeId}`}>
                          <strong>{r.sevak?.name ?? "Unknown sevak"}</strong>
                        </Link>
                        <span className="p-muted">
                          {r.sevak?.phone} · {formatINR(r.amount)}
                          {perLabel(r.frequency)}
                          {r.mode && ` · ${MODE_SHORT[r.mode]}`}
                          {r.assignee && ` · ${r.assignee.name}`}
                        </span>
                      </span>
                      <span className="row-meta">
                        <DueStateBadge state={r.state} />
                        <span>{paidText(r)}</span>
                        {r.canNote && r.state !== "paid" && open !== r.pledgeId && (
                          <button type="button" className="pbtn pbtn-ghost pbtn-small" onClick={() => setOpen(r.pledgeId)}>
                            {r.note ? "Change reason" : "Add reason"}
                          </button>
                        )}
                      </span>
                    </div>
                    <div className="due-month-note">
                      {open === r.pledgeId ? (
                        <ReasonForm
                          pledgeId={r.pledgeId}
                          month={month}
                          note={r.note}
                          onCancel={() => setOpen(null)}
                          onSaved={() => {
                            setOpen(null);
                            reload();
                          }}
                        />
                      ) : (
                        r.note && <NoteText note={r.note} />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
