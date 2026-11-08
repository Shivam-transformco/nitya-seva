import { useState } from "react";
import { api, qs, useApi } from "../api";
import {
  CHANNEL_LABELS,
  METHOD_LABELS,
  OUTCOME_LABELS,
  STATUS_LABELS,
  can,
  formatDate,
  formatDateTime,
  formatINR,
  monthLabel,
  plural,
} from "../format";
import { Link, navigate } from "../router";
import { Empty, ErrorNote, Loading, PageHead, Pager } from "../ui";

const KINDS = [
  { id: "", label: "Everything" },
  { id: "pledge", label: "Pledges" },
  { id: "payment", label: "Payments" },
  { id: "followup", label: "Follow-ups" },
];

function describe(item) {
  if (item.kind === "pledge") {
    const p = item.pledge;
    const extra = [
      item.followups.length && plural(item.followups.length, "follow-up"),
      item.payments.length && plural(item.payments.length, "payment"),
    ].filter(Boolean);
    return {
      title: `Pledge · ${item.sevakName}`,
      sub: `${formatINR(p.amount)} a month · ${p.seva} · ${STATUS_LABELS[p.status]} · pledged ${formatDate(p.createdAt)}${extra.length ? ` · with ${extra.join(" and ")}` : ""}`,
    };
  }
  if (item.kind === "payment") {
    const pay = item.payments[0];
    return {
      title: `Payment · ${item.sevakName}`,
      sub: `${formatINR(pay.amount)} for ${monthLabel(pay.month)} · ${METHOD_LABELS[pay.method]} · receipt ${pay.receiptNo}`,
    };
  }
  const f = item.followups[0];
  return {
    title: `Follow-up · ${item.sevakName}`,
    sub: `${CHANNEL_LABELS[f.channel]} · ${OUTCOME_LABELS[f.outcome]} · ${formatDateTime(f.createdAt)}${f.note ? ` · “${f.note}”` : ""}`,
  };
}

export default function Deleted({ params, user }) {
  const canPurge = can(user, "bin.purge");
  const kind = params.get("kind") ?? "";
  const page = params.get("page") ?? "";
  const list = useApi(`/deleted${qs({ kind, page })}`);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  async function act(item, action) {
    if (action === "purge" && !window.confirm("Delete this for good? It can't be brought back.")) return;
    setError(null);
    setBusyId(item._id);
    try {
      if (action === "restore") {
        const { pledgeId } = await api(`/deleted/${item._id}/restore`, { method: "POST" });
        navigate(`/pledges/${pledgeId}`);
        return;
      }
      await api(`/deleted/${item._id}`, { method: "DELETE" });
      list.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <p className="crumbs">
        <Link to="/pledges">← All pledges</Link>
      </p>
      <PageHead title="Recently deleted" sub="Pledges, payments and follow-ups staff have deleted. Restore puts them back exactly as they were." />

      <div className="tabs" role="tablist">
        {KINDS.map((k) => (
          <button key={k.id} role="tab" aria-selected={kind === k.id} onClick={() => navigate(`/deleted${qs({ kind: k.id })}`)}>
            {k.label}
          </button>
        ))}
      </div>

      <section className="p-card p-card-flush">
        <ErrorNote error={error ?? list.error} />
        {list.data ? (
          !list.data.items.length ? (
            <Empty>Nothing deleted.</Empty>
          ) : (
            <>
              <ul className="rows">
                {list.data.items.map((item) => {
                  const { title, sub } = describe(item);
                  return (
                    <li key={item._id} className="row row-static">
                      <span className="row-main">
                        <strong>{title}</strong>
                        <span className="p-muted">{sub}</span>
                        <span className="p-hint">
                          Deleted by {item.deletedByName}, {formatDateTime(item.deletedAt)}
                          {item.reason && ` · “${item.reason}”`}
                          {!item.canRestore && " · restore its pledge first"}
                        </span>
                      </span>
                      <span className="row-meta">
                        <button
                          type="button"
                          className="pbtn pbtn-ghost pbtn-small"
                          disabled={busyId === item._id || !item.canRestore}
                          onClick={() => act(item, "restore")}
                        >
                          Restore
                        </button>
                        {canPurge && (
                          <button
                            type="button"
                            className="pbtn pbtn-ghost pbtn-small"
                            disabled={busyId === item._id}
                            onClick={() => act(item, "purge")}
                          >
                            Delete for good
                          </button>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <Pager
                page={list.data.page}
                limit={list.data.limit}
                total={list.data.total}
                onPage={(p) => navigate(`/deleted${qs({ kind, page: String(p) })}`)}
              />
            </>
          )
        ) : (
          list.loading && <Loading />
        )}
      </section>
    </>
  );
}
