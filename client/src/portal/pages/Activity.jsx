import { qs, useApi } from "../api";
import { formatDateTime } from "../format";
import { Link, navigate } from "../router";
import { Empty, ErrorNote, Loading, PageHead, Pager } from "../ui";

const ACTION_LABELS = {
  "auth.login": "Signed in",
  "auth.password_change": "Changed their password",
  "user.create": "Added a staff member",
  "user.update": "Changed a staff account",
  "pledge.create": "Added a pledge",
  "pledge.edit": "Edited a pledge",
  "pledge.status": "Changed a status",
  "pledge.status_correct": "Corrected a status",
  "pledge.status_undo": "Undid a status change",
  "pledge.assign": "Assigned a pledge",
  "pledge.flag": "Marked a pledge not genuine",
  "pledge.unflag": "Removed a not-genuine mark",
  "pledge.counter_hide": "Hid a pledge from the counter",
  "pledge.counter_show": "Put a pledge back on the counter",
  "pledge.payment_setup": "Recorded how a sevak pays",
  "pledge.payment_setup_clear": "Cleared how a sevak pays",
  "pledge.delete": "Deleted a pledge",
  "pledge.restore": "Restored a pledge",
  "pledge.purge": "Permanently deleted a pledge",
  "followup.create": "Logged a follow-up",
  "followup.delete": "Deleted a follow-up",
  "followup.restore": "Restored a follow-up",
  "followup.purge": "Permanently deleted a follow-up",
  "payment.create": "Recorded a payment",
  "payment.create_many": "Entered past payments",
  "payment.delete": "Deleted a payment",
  "payment.restore": "Restored a payment",
  "payment.purge": "Permanently deleted a payment",
  "sevak.edit": "Edited a sevak",
  "sevak.merge": "Merged two sevak records",
  "counter.target_update": "Changed the counter target",
  "counter.adjustment_create": "Added a counter adjustment",
  "counter.adjustment_update": "Changed a counter adjustment",
  "counter.adjustment_delete": "Removed a counter adjustment",
};

const FILTERS = [
  { id: "", label: "Everything" },
  { id: "pledge.", label: "Pledges" },
  { id: "payment.", label: "Payments" },
  { id: "followup.", label: "Follow-ups" },
  { id: "user.", label: "Staff" },
  { id: "sevak.", label: "Sevaks" },
  { id: "counter.", label: "Counter" },
  { id: "auth.", label: "Sign-ins" },
];

/** A short, readable summary of an entry's details. */
function summary(data) {
  if (!data) return "";
  const parts = [];
  for (const [k, v] of Object.entries(data)) {
    if (v == null || v === "" || k === "merged" || /Id$/.test(k)) continue;
    if (typeof v === "object" && !Array.isArray(v)) {
      if ("from" in v && "to" in v) parts.push(`${k}: ${v.from} → ${v.to}`);
      else parts.push(`${k}: ${Object.entries(v).map(([a, b]) => `${a} ${b}`).join(", ")}`);
    } else {
      parts.push(`${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
    }
  }
  return parts.join(" · ");
}

export default function Activity({ params }) {
  const action = params.get("action") ?? "";
  const page = params.get("page") ?? "";
  const { data, error, loading } = useApi(`/audit${qs({ action, page, limit: "50" })}`);
  const go = (changes) => navigate(`/activity${qs({ action, page: "", ...changes })}`);

  return (
    <>
      <PageHead title="Activity" sub="Everything staff have done in the portal, newest first. Only owners see this." />
      <div className="tabs" role="tablist">
        {FILTERS.map((f) => (
          <button key={f.id} role="tab" aria-selected={action === f.id} onClick={() => go({ action: f.id })}>
            {f.label}
          </button>
        ))}
      </div>
      <section className="p-card p-card-flush">
        <ErrorNote error={error} />
        {!data ? (
          loading && <Loading />
        ) : !data.items.length ? (
          <Empty>Nothing yet.</Empty>
        ) : (
          <>
            <ul className="rows">
              {data.items.map((a) => (
                <li key={a._id} className="row row-static">
                  <span className="row-main">
                    <strong>
                      {a.actorName} · {ACTION_LABELS[a.action] ?? a.action}
                    </strong>
                    <span className="p-muted">{summary(a.data)}</span>
                  </span>
                  <span className="row-meta p-muted">
                    <span>{formatDateTime(a.createdAt)}</span>
                    {a.entity === "pledge" && a.entityId && <Link to={`/pledges/${a.entityId}`}>Open pledge</Link>}
                  </span>
                </li>
              ))}
            </ul>
            <Pager page={data.page} limit={data.limit} total={data.total} onPage={(p) => go({ page: String(p) })} />
          </>
        )}
      </section>
    </>
  );
}
