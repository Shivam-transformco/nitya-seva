import { useEffect } from "react";
import { api, notificationsChanged, useApi } from "../api";
import { formatDateTime } from "../format";
import { navigate } from "../router";
import { Empty, ErrorNote, Loading, PageHead } from "../ui";

export default function Notifications() {
  const { data, error, loading, reload } = useApi("/notifications?limit=50");

  useEffect(() => {
    if (data) notificationsChanged();
  }, [data]);

  async function open(n) {
    if (!n.readAt) await api(`/notifications/${n._id}/read`, { method: "POST" }).catch(() => {});
    notificationsChanged();
    navigate(n.link || "/");
  }

  async function readAll() {
    await api("/notifications/read-all", { method: "POST" });
    reload();
  }

  return (
    <>
      <PageHead
        title="Notifications"
        sub={data ? `${data.unread} unread` : null}
        actions={
          data?.unread > 0 && (
            <button className="pbtn pbtn-ghost" onClick={readAll}>
              Mark all as read
            </button>
          )
        }
      />
      <section className="p-card p-card-flush">
        <ErrorNote error={error} />
        {!data ? (
          loading && <Loading />
        ) : !data.items.length ? (
          <Empty>Nothing here yet. You'll be told about new pledges, assignments and due follow-ups.</Empty>
        ) : (
          <ul className="rows">
            {data.items.map((n) => (
              <li key={n._id}>
                <button type="button" className={`row notice${n.readAt ? "" : " unread"}`} onClick={() => open(n)}>
                  <span className="row-main">
                    <strong>{n.title}</strong>
                    <span>{n.body}</span>
                  </span>
                  <span className="row-side p-muted">{formatDateTime(n.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
