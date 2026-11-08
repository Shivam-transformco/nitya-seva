import { useState } from "react";
import { qs, useApi } from "../api";
import { METHOD_LABELS, currentFy, formatDate, formatINR, fyLabel, monthLabel, plural } from "../format";
import { Link, navigate } from "../router";
import { Empty, ErrorNote, Loading, PageHead } from "../ui";

/** Financial years from when the portal started to now. */
const FIRST_FY = 2023;
const years = () => Array.from({ length: currentFy() - FIRST_FY + 1 }, (_, i) => currentFy() - i);

function FySelect({ fy, onChange }) {
  return (
    <select aria-label="Financial year" value={fy} onChange={(e) => onChange(Number(e.target.value))}>
      {years().map((y) => (
        <option key={y} value={y}>
          April {y} – March {y + 1} ({fyLabel(y)})
        </option>
      ))}
    </select>
  );
}

/** Everyone who gave in a financial year, by the date the money came. */
export default function Statements({ params }) {
  const fy = Number(params.get("fy")) || currentFy();
  const q = params.get("q") ?? "";
  const [search, setSearch] = useState(q);
  const { data, error, loading } = useApi(`/statements${qs({ fy, q })}`);
  const go = (next) => navigate(`/statements${qs({ fy, q, ...next })}`);

  return (
    <>
      <p className="crumbs">
        <Link to="/reports">← Reports</Link>
      </p>
      <PageHead title="Yearly statements" sub="What each sevak gave in a financial year, by the date it was received. Open one to print it for them." />
      <div className="filters">
        <form
          className="search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            go({ q: search.trim().length >= 2 ? search.trim() : "" });
          }}
        >
          <input type="search" placeholder="Search name or phone" aria-label="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="pbtn pbtn-ghost">Search</button>
        </form>
        <FySelect fy={fy} onChange={(y) => go({ fy: y })} />
      </div>
      <section className="p-card p-card-flush">
        <ErrorNote error={error} />
        {!data ? (
          loading && <Loading />
        ) : !data.sevaks.length ? (
          <Empty>No payments were received in {fyLabel(fy)}.</Empty>
        ) : (
          <>
            <p className="p-muted rows-count">
              {plural(data.sevaks.length, "sevak")} · {formatINR(data.total)} received in {data.label}
            </p>
            <div className="table-wrap">
              <table className="ptable" aria-label={`Sevaks who gave in ${data.label}`}>
                <thead>
                  <tr>
                    <th>Sevak</th>
                    <th className="num">Payments</th>
                    <th className="num">Total</th>
                    <th>Last received</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sevaks.map((s) => (
                    <tr key={s.sevakId}>
                      <td>
                        <Link to={`/statements/${s.sevakId}?fy=${fy}`}>{s.name}</Link>
                        <div className="p-muted">{s.phone}</div>
                      </td>
                      <td className="num">{s.payments}</td>
                      <td className="num">{formatINR(s.amount)}</td>
                      <td>{formatDate(s.lastReceivedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </>
  );
}

/** One sevak's statement for a financial year, laid out for printing. */
export function Statement({ sevakId, params }) {
  const fy = Number(params.get("fy")) || currentFy();
  const { data, error, loading } = useApi(`/statements/${sevakId}?fy=${fy}`);

  return (
    <>
      <p className="crumbs">
        <Link to={`/statements?fy=${fy}`}>← Yearly statements</Link>
      </p>
      <div className="btn-row no-print">
        <FySelect fy={fy} onChange={(y) => navigate(`/statements/${sevakId}?fy=${y}`)} />
        <button type="button" className="pbtn" onClick={() => window.print()} disabled={!data}>
          Print
        </button>
      </div>
      <ErrorNote error={error} />
      {!data ? (
        loading && <Loading />
      ) : (
        <section className="p-card statement">
          <div className="statement-head">
            <div>
              <h1>Nitya Seva statement</h1>
              <p>
                ISKCON BACE Jiasarai
                <br />
                Financial year {data.label} (1 April {fy} to 31 March {fy + 1})
              </p>
            </div>
            <img src="../images/ISKCON_logo_2.png" alt="" />
          </div>
          <dl className="facts">
            <dt>Sevak</dt>
            <dd>{data.sevak.name}</dd>
            <dt>Phone</dt>
            <dd>{data.sevak.phone}</dd>
            {data.sevak.email && (
              <>
                <dt>Email</dt>
                <dd>{data.sevak.email}</dd>
              </>
            )}
          </dl>
          {!data.payments.length ? (
            <Empty>No payments were received from {data.sevak.name} in {data.label}.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="ptable" aria-label="Payments">
                <thead>
                  <tr>
                    <th>Received</th>
                    <th>Receipt</th>
                    <th>For</th>
                    <th>Method</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map((p) => (
                    <tr key={p._id}>
                      <td>{formatDate(p.receivedAt)}</td>
                      <td>{p.receiptNo}</td>
                      <td>
                        {monthLabel(p.month)}
                        {p.seva && <div className="p-muted">{p.seva}</div>}
                      </td>
                      <td>
                        {METHOD_LABELS[p.method] ?? p.method}
                        {p.reference && <div className="p-muted">{p.reference}</div>}
                      </td>
                      <td className="num">{formatINR(p.amount)}</td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td colSpan={4}>Total received</td>
                    <td className="num">{formatINR(data.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="p-muted">Hare Krishna. Thank you for your Nitya Seva.</p>
        </section>
      )}
    </>
  );
}
