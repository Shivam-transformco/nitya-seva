import { useState } from "react";
import { useApi } from "../api";
import { DueStateBadge, NoteText, ReasonForm } from "../dues";
import { MODE_SHORT, formatINR, monthLabel, perLabel, plural, telLink, unpaidLabel, waLink } from "../format";
import { Link } from "../router";
import { Empty, ErrorNote, Loading, PageHead } from "../ui";

/** Confirmed sevaks whose gifts haven't come, the longest run first. */
export default function Overdue({ user }) {
  const { data, error, loading, reload } = useApi("/dues/overdue");
  const [open, setOpen] = useState(null);
  const total = data?.reduce((s, r) => s + r.owed, 0) ?? 0;

  return (
    <>
      <PageHead
        title="Missed payments"
        sub="Confirmed sevaks with a gift overdue this month or missed in the last 12 months. A reason marked excused takes the month off this list."
      />
      <ErrorNote error={error} />
      {!data ? (
        loading && <Loading />
      ) : !data.length ? (
        <section className="p-card">
          <Empty>Everyone is up to date.</Empty>
        </section>
      ) : (
        <section className="p-card p-card-flush">
          <p className="p-muted rows-count">
            {plural(data.length, "sevak")} · {formatINR(total)} not paid
          </p>
          <ul className="rows">
            {data.map((r) => {
              const latest = r.months.at(-1);
              const first = r.sevak?.name.split(" ")[0] ?? "";
              const text = `Hare Krishna ${first}! This is ${user.name} from ISKCON BACE Jiasarai. We haven't received your Nitya Seva offering for ${monthLabel(latest.month)} yet. Is everything alright?`;
              return (
                <li key={r.pledgeId} className="dues-owing">
                  <div className="row row-static">
                    <span className="row-main">
                      <Link to={`/pledges/${r.pledgeId}`}>
                        <strong>{r.sevak?.name ?? "Unknown sevak"}</strong>
                      </Link>
                      <span className="p-muted">
                        {formatINR(r.amount)}
                        {perLabel(r.frequency)}
                        {r.mode && ` · ${MODE_SHORT[r.mode]}`}
                        {r.assignee ? ` · ${r.assignee.name}` : " · Unassigned"}
                        {` · last paid ${r.lastPaidMonth ? monthLabel(r.lastPaidMonth) : "never"}`}
                      </span>
                    </span>
                    <span className="row-meta">
                      <strong>
                        {r.missedInRow === r.months.length
                          ? r.missedInRow === 1
                            ? "1 gift"
                            : `${r.missedInRow} in a row`
                          : unpaidLabel(r.missedInRow, r.months.map((m) => m.month))}
                      </strong>
                      <DueStateBadge state={latest.state} />
                      <span>{formatINR(r.owed)} owed</span>
                    </span>
                  </div>
                  <div className="due-month-note">
                    {open === r.pledgeId ? (
                      <ReasonForm
                        pledgeId={r.pledgeId}
                        month={latest.month}
                        note={r.latestNote?.month === latest.month ? r.latestNote : null}
                        onCancel={() => setOpen(null)}
                        onSaved={() => {
                          setOpen(null);
                          reload();
                        }}
                      />
                    ) : (
                      <div className="dues-row">
                        {r.latestNote ? (
                          <span>
                            {monthLabel(r.latestNote.month)}: <NoteText note={r.latestNote} />
                          </span>
                        ) : (
                          <span className="p-muted">No reason recorded</span>
                        )}
                        {r.sevak && (
                          <>
                            <a className="pbtn pbtn-ghost pbtn-small" href={telLink(r.sevak.phone)}>
                              Call
                            </a>
                            <a className="pbtn pbtn-ghost pbtn-small" href={waLink(r.sevak.phone, text)} target="_blank" rel="noopener">
                              WhatsApp
                            </a>
                          </>
                        )}
                        {r.canNote && (
                          <button type="button" className="pbtn pbtn-ghost pbtn-small" onClick={() => setOpen(r.pledgeId)}>
                            Reason for {monthLabel(latest.month)}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
