import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, CalendarCheck } from "lucide-react";
import client from "../api/client";
import ChildSwitcher, { useLinkedChildren } from "../components/ChildSwitcher";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";
import Modal from "../components/Modal";
import { Table, TableHead, TableTh, TableBody, TableRow, TableTd } from "../components/Table";

const STATUS_STYLE = {
  Present: { bg: "var(--color-success-subtle)", fg: "var(--color-success)", tone: "success" },
  Absent: { bg: "var(--color-danger-subtle)", fg: "var(--color-danger)", tone: "danger" },
  Leave: { bg: "var(--color-warning-subtle)", fg: "var(--color-warning)", tone: "warning" },
};
const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const pctText = (p) => (p === null || p === undefined ? "—" : `${p}%`);

function shiftMonth(month, delta) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function Figure({ label, value, color }) {
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: "var(--color-surface-sunken)" }}>
      <div className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>{label}</div>
      <div className="text-xl font-bold tabular-nums" style={{ color: color || "var(--color-text-primary)" }}>{value}</div>
    </div>
  );
}

function Calendar({ studentId }) {
  const [month, setMonth] = useState(() => new Date().toLocaleDateString("en-CA").slice(0, 7));
  const [cal, setCal] = useState(null);
  const [day, setDay] = useState(null);

  useEffect(() => {
    setCal(null);
    client.get(`/attendance/student/${studentId}/calendar`, { params: { month } }).then(({ data }) => setCal(data)).catch(() => setCal({ error: true }));
  }, [studentId, month]);

  const cells = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const lead = (first.getDay() + 6) % 7; // Monday first
    const count = new Date(y, m, 0).getDate();
    return [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  }, [month]);

  return (
    <div className="glass rounded-2xl p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <button aria-label="Previous month" onClick={() => setMonth((x) => shiftMonth(x, -1))} className="p-2 rounded-lg hover:bg-black/5"><ChevronLeft size={18} /></button>
        <div className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>
          {new Date(`${month}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
        </div>
        <button aria-label="Next month" onClick={() => setMonth((x) => shiftMonth(x, 1))} className="p-2 rounded-lg hover:bg-black/5"><ChevronRight size={18} /></button>
      </div>
      {!cal ? (
        <Loader label="Loading calendar…" />
      ) : cal.error ? (
        <p className="text-sm" style={{ color: "var(--color-danger)" }}>Couldn't load the calendar.</p>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEK.map((w) => <div key={w} className="text-[10px] font-semibold py-1" style={{ color: "var(--color-text-muted)" }}>{w}</div>)}
            {cells.map((d, i) => {
              if (!d) return <div key={`b${i}`} />;
              const status = cal.summary[d];
              const past = d <= cal.today;
              const st = STATUS_STYLE[status];
              return (
                <button
                  key={d}
                  onClick={() => status && setDay(d)}
                  disabled={!status}
                  aria-label={`${d}: ${status || (past ? "not marked" : "upcoming")}`}
                  className="aspect-square rounded-lg text-xs sm:text-sm font-medium flex flex-col items-center justify-center border"
                  style={{
                    background: st ? st.bg : "transparent",
                    color: st ? st.fg : past ? "var(--color-text-secondary)" : "var(--color-text-muted)",
                    borderColor: st ? "transparent" : "var(--color-border-subtle)",
                    opacity: past || st ? 1 : 0.55,
                  }}
                >
                  {Number(d.slice(8))}
                  <span className="text-[8px] sm:text-[9px] leading-none mt-0.5 font-semibold">
                    {status ? status[0] : past ? "—" : ""}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 mt-3 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
            <span>P = Present</span><span>A = Absent</span><span>L = Leave</span><span>— = Not marked</span>
          </div>
        </>
      )}
      <Modal open={!!day} onClose={() => setDay(null)} title={day ? new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : ""}>
        {day && cal?.days?.[day] && (
          <div className="space-y-2">
            {cal.days[day].map((x, i) => (
              <div key={i} className="rounded-xl p-3 flex items-start justify-between gap-3" style={{ background: "var(--color-surface-sunken)" }}>
                <div className="min-w-0 text-sm">
                  <div className="font-semibold" style={{ color: "var(--color-text-primary)" }}>{x.subjectName}</div>
                  <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    Period {x.period || "—"} · {x.className}{x.sectionName ? ` ${x.sectionName}` : ""} · {x.facultyName || "—"}
                  </div>
                </div>
                <StatusBadge tone={STATUS_STYLE[x.status]?.tone}>{x.status}</StatusBadge>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

/** A student's own attendance, or a parent's linked child's. */
export default function StudentAttendance() {
  const linked = useLinkedChildren();
  const studentId = linked.activeId;
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    if (!studentId) return;
    setError(false);
    setData(null);
    client.get(`/attendance/student/${studentId}`).then(({ data: d }) => setData(d)).catch(() => setError(true));
  }, [studentId]);
  useEffect(load, [load]);

  if (!studentId) return <EmptyState icon={AlertTriangle} title="No student is linked to this account." />;

  return (
    <div className="space-y-5 max-w-5xl">
      <ChildSwitcher linked={linked} />
      {error ? (
        <ErrorState message="Couldn't load attendance." onRetry={load} />
      ) : !data ? (
        <Loader label="Loading attendance…" />
      ) : (
        <>
          <div className="glass rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>Overall attendance</p>
                <div className="text-4xl font-extrabold tabular-nums" style={{ color: data.belowThreshold ? "var(--color-danger)" : "var(--color-success)" }}>
                  {pctText(data.overallPercentage)}
                </div>
              </div>
              {data.belowThreshold && (
                <StatusBadge tone="danger">Below the required {data.policy.lowThreshold}%</StatusBadge>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Figure label="Total classes" value={data.totals.total} />
              <Figure label="Present" value={data.totals.present} color="var(--color-success)" />
              <Figure label="Absent" value={data.totals.absent} color="var(--color-danger)" />
              <Figure label="Leave" value={data.totals.leave} color="var(--color-warning)" />
            </div>
            <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
              Attendance % = {data.policy.formula}. Required: {data.policy.lowThreshold}%.
            </p>
          </div>

          <div className="glass rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b font-semibold text-sm" style={{ borderColor: "var(--color-border-subtle)", color: "var(--color-text-primary)" }}>
              Subject-wise attendance
            </div>
            {data.subjectSummary.length === 0 ? (
              <EmptyState icon={CalendarCheck} title="No attendance records available." description="Attendance appears here once registers are taken." />
            ) : (
              <Table>
                <TableHead>
                  <TableTh>Subject</TableTh>
                  <TableTh>Total</TableTh>
                  <TableTh>Present</TableTh>
                  <TableTh>Absent</TableTh>
                  <TableTh>Leave</TableTh>
                  <TableTh align="right">Attendance %</TableTh>
                </TableHead>
                <TableBody>
                  {data.subjectSummary.map((s) => (
                    <TableRow key={s.subject}>
                      <TableTd className="font-medium">{s.subjectName}</TableTd>
                      <TableTd>{s.total}</TableTd>
                      <TableTd>{s.present}</TableTd>
                      <TableTd>{s.absent}</TableTd>
                      <TableTd>{s.leave}</TableTd>
                      <TableTd align="right">
                        <StatusBadge tone={s.percentage === null ? "neutral" : s.percentage < data.policy.lowThreshold ? "danger" : "success"}>
                          {pctText(s.percentage)}
                        </StatusBadge>
                      </TableTd>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <Calendar studentId={studentId} />
        </>
      )}
    </div>
  );
}
