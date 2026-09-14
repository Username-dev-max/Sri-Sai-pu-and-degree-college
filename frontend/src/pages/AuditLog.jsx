import { useCallback, useEffect, useState } from "react";
import { ScrollText, Search, ChevronDown, ChevronRight } from "lucide-react";
import client from "../api/client";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import Button from "../components/Button";
import StatusBadge from "../components/StatusBadge";

/** Colour the verb so destructive actions stand out when scanning. */
function toneFor(action) {
  if (/deleted|deactivated/.test(action)) return "danger";
  if (/created|enrolled|activated|published/.test(action)) return "success";
  if (/updated|reset|toggled/.test(action)) return "warning";
  return "info";
}

function Diff({ before, after }) {
  if (!before && !after) return null;
  const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])]
    // Only show what actually changed — a full record dump is unreadable.
    .filter((k) => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]));
  if (keys.length === 0) return null;

  const show = (v) => (v === undefined || v === null || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

  return (
    <div className="mt-2.5 rounded-lg overflow-hidden text-xs" style={{ border: "1px solid var(--color-border-subtle)" }}>
      {keys.map((k) => (
        <div key={k} className="grid grid-cols-[auto_1fr_1fr] gap-2 px-2.5 py-1.5 border-b last:border-0" style={{ borderColor: "var(--color-border-subtle)" }}>
          <span className="font-medium" style={{ color: "var(--color-text-muted)" }}>{k}</span>
          <span className="line-through truncate" style={{ color: "var(--color-danger)" }}>{show(before?.[k])}</span>
          <span className="truncate" style={{ color: "var(--color-success)" }}>{show(after?.[k])}</span>
        </div>
      ))}
    </div>
  );
}

export default function AuditLog() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(() => {
    setError(false);
    const params = new URLSearchParams({ page: String(page) });
    if (q) params.set("q", q);
    if (action) params.set("action", action);
    if (entityType) params.set("entityType", entityType);
    client.get(`/admin/audit?${params}`).then(({ data: d }) => setData(d)).catch(() => setError(true));
  }, [q, action, entityType, page]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  if (error) return <ErrorState full message="Couldn't load the audit log." onRetry={load} />;
  if (!data) return <Loader full label="Loading audit log…" />;

  return (
    <div className="space-y-5">
      <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
        Every administrative action is recorded here with who performed it and when. Entries cannot be edited or removed.
      </p>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-text-muted)" }} />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search by summary, person or record ID…" className="input pl-9" />
        </div>
        <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="input w-auto">
          <option value="">All actions</option>
          {data.actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }} className="input w-auto">
          <option value="">All record types</option>
          {data.entityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {data.logs.length === 0 ? (
        <EmptyState icon={ScrollText} title="Nothing recorded yet" description="Administrative actions will appear here as they happen." />
      ) : (
        <>
          <div className="space-y-2">
            {data.logs.map((l) => {
              const open = expanded === l.id;
              const hasDetail = l.before || l.after;
              return (
                <div key={l.id} className="glass rounded-xl p-3.5">
                  <button
                    onClick={() => setExpanded(open ? null : l.id)}
                    className="w-full flex items-start gap-3 text-left"
                    disabled={!hasDetail}
                  >
                    {hasDetail ? (
                      open ? <ChevronDown size={15} className="mt-0.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
                           : <ChevronRight size={15} className="mt-0.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
                    ) : (
                      <span className="w-[15px] shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge tone={toneFor(l.action)}>{l.action}</StatusBadge>
                        <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>{l.summary}</span>
                      </div>
                      <div className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                        {l.actorName} ({l.actorRole}) · {new Date(l.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                        {l.entityId && ` · ${l.entityType} ${l.entityId}`}
                        {l.ip && ` · ${l.ip}`}
                      </div>
                    </div>
                  </button>
                  {open && <Diff before={l.before} after={l.after} />}
                </div>
              );
            })}
          </div>

          {data.pages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: "var(--color-text-muted)" }}>
                {data.total} entries · page {data.page} of {data.pages}
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={data.page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button variant="secondary" disabled={data.page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
