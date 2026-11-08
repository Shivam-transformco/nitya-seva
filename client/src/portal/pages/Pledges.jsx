import { useState } from "react";
import { qs, useApi } from "../api";
import {
  FLAG_LABELS,
  FREQUENCIES,
  MODE_LABELS,
  ORIGIN_LABELS,
  STATUSES,
  STATUS_LABELS,
  can,
  dueLabel,
  formatDate,
  formatINR,
  perLabel,
  plural,
} from "../format";
import { Link, navigate } from "../router";
import { DueBadge, Empty, ErrorNote, Loading, ModeBadge, OriginBadge, PageHead, Pager, StatusBadge } from "../ui";

const FILTER_KEYS = ["status", "assignedTo", "due", "overdue", "flagged", "hidden", "mode", "mandate", "origin", "frequency", "q", "sort", "page"];

const CLEAR_VIEW = { due: "", overdue: "", flagged: "", hidden: "" };
const VIEWS = [
  { id: "all", label: "All", params: {} },
  { id: "due", label: "Due today", params: { due: "true", sort: "nextFollowUp" } },
  { id: "overdue", label: "Payment overdue", params: { overdue: "true" } },
  { id: "hidden", label: "Hidden from counter", params: { hidden: "true" }, adminOnly: true },
  { id: "flagged", label: "Not genuine", params: { flagged: "true" } },
];

export function PledgeRows({ items, showAssignee }) {
  if (!items.length) return <Empty>No pledges match.</Empty>;
  return (
    <ul className="rows">
      {items.map((p) => (
        <li key={p._id}>
          <Link to={`/pledges/${p._id}`} className="row">
            <span className="row-main">
              <strong>{p.sevak?.name ?? "Unknown sevak"}</strong>
              <span className="p-muted">
                {p.sevak?.phone} · {p.seva}
              </span>
            </span>
            <span className="row-amount">
              {p.amount ? (
                <>
                  {formatINR(p.amount)}
                  <small>{perLabel(p.frequency)}</small>
                </>
              ) : (
                <small>Amount not set</small>
              )}
            </span>
            <span className="row-meta">
              <StatusBadge status={p.status} />
              <OriginBadge origin={p.origin} />
              {!p.flag && <ModeBadge setup={p.paymentSetup} />}
              {p.flag && <span className="badge badge-flag">{FLAG_LABELS[p.flag.reason]}</span>}
              {!p.flag && p.hiddenFromCounter && <span className="badge badge-hidden">Off counter</span>}
              {!p.flag && <DueBadge due={dueLabel(p.nextFollowUpAt)} />}
              {p.owing && (
                <span className="badge badge-due-missed">
                  {p.owing.missedInRow === 1 ? "Payment overdue" : `${p.owing.missedInRow} payments missed`}
                </span>
              )}
            </span>
            <span className="row-side p-muted">
              {showAssignee && <span>{p.assignee ? p.assignee.name : "Unassigned"}</span>}
              <span>{formatDate(p.createdAt)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function Pledges({ params, user }) {
  const isAdmin = can(user, "pledges.viewAll");
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? ""]));
  const staff = useApi(isAdmin ? "/users" : null);
  const list = useApi(`/pledges${qs(filters)}`);
  const [search, setSearch] = useState(filters.q);
  const view =
    filters.flagged === "true"
      ? "flagged"
      : filters.hidden === "true"
        ? "hidden"
        : filters.overdue === "true"
          ? "overdue"
          : filters.due === "true"
            ? "due"
            : "all";

  const update = (changes) => {
    const next = { ...filters, page: "", ...changes };
    navigate(`/pledges${qs(next)}`);
  };

  function submitSearch(e) {
    e.preventDefault();
    const q = search.trim();
    update({ q: q.length >= 2 ? q : "" });
  }

  return (
    <>
      <PageHead
        title={isAdmin ? "Pledges" : "My sevaks"}
        sub={isAdmin ? "Everyone who has offered Nitya Seva." : "Sevaks assigned to you for follow-up."}
        actions={
          <>
            {can(user, "bin.manage") && (
              <Link to="/deleted" className="pbtn pbtn-ghost pbtn-small">
                Recently deleted
              </Link>
            )}
            {can(user, "pledges.manage") && (
              <Link to="/pledges/new" className="pbtn pbtn-small">
                Add pledge
              </Link>
            )}
          </>
        }
      />

      <div className="tabs" role="tablist">
        {VIEWS.filter((v) => isAdmin || !v.adminOnly).map((v) => (
          <button key={v.id} role="tab" aria-selected={view === v.id} onClick={() => update({ ...CLEAR_VIEW, ...v.params })}>
            {v.label}
          </button>
        ))}
      </div>

      <div className="filters">
        <form className="search" onSubmit={submitSearch} role="search">
          <input type="search" placeholder="Search name, phone or email" aria-label="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="pbtn pbtn-ghost">Search</button>
        </form>
        <select aria-label="Status" value={filters.status} onChange={(e) => update({ status: e.target.value })}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          aria-label="How they pay"
          value={filters.mandate === "submitted" ? "pending" : filters.mode}
          onChange={(e) =>
            update(e.target.value === "pending" ? { mode: "", mandate: "submitted" } : { mode: e.target.value, mandate: "" })
          }
        >
          <option value="">Any payment mode</option>
          {Object.entries(MODE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
          <option value="pending">Mandate not active yet</option>
          <option value="none">Not recorded</option>
        </select>
        <select aria-label="Came from" value={filters.origin} onChange={(e) => update({ origin: e.target.value })}>
          <option value="">Any source</option>
          {Object.entries(ORIGIN_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select aria-label="How often" value={filters.frequency} onChange={(e) => update({ frequency: e.target.value })}>
          <option value="">Any frequency</option>
          {FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        {isAdmin && (
          <select aria-label="Assigned to" value={filters.assignedTo} onChange={(e) => update({ assignedTo: e.target.value })}>
            <option value="">Anyone</option>
            <option value="none">Unassigned</option>
            {staff.data?.map((u) => (
              <option key={u._id} value={u._id}>
                {u.name}
              </option>
            ))}
          </select>
        )}
        <select aria-label="Sort" value={filters.sort || "newest"} onChange={(e) => update({ sort: e.target.value })}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="nextFollowUp">Next follow-up</option>
        </select>
      </div>

      <section className="p-card p-card-flush">
        <ErrorNote error={list.error} />
        {list.data ? (
          <>
            <p className="p-muted rows-count">{plural(list.data.total, "pledge")}</p>
            <PledgeRows items={list.data.items} showAssignee={isAdmin} />
            <Pager page={list.data.page} limit={list.data.limit} total={list.data.total} onPage={(page) => update({ page: String(page) })} />
          </>
        ) : (
          list.loading && <Loading />
        )}
      </section>
    </>
  );
}
