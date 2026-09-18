import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCheck, UserX, Save, AlertTriangle, CalendarCheck, Pencil, Eye, CheckCircle2, Lock } from "lucide-react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import useAcademicScope from "../hooks/useAcademicScope";
import AcademicFilters from "../components/AcademicFilters";
import StatusToggle from "../components/StatusToggle";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import Button from "../components/Button";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";

const todayLocal = () => new Date().toLocaleDateString("en-CA");
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "");
const fmtDate = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "");

function Banner({ tone = "info", icon: Icon = AlertTriangle, children }) {
  const colors = {
    info: ["rgba(59,130,246,0.10)", "var(--color-brand-600)"],
    warning: ["var(--color-warning-subtle)", "var(--color-warning)"],
    danger: ["var(--color-danger-subtle)", "var(--color-danger)"],
    success: ["var(--color-success-subtle)", "var(--color-success)"],
  }[tone];
  return (
    <div className="rounded-xl px-4 py-3 flex items-start gap-2.5 text-sm" style={{ background: colors[0], color: colors[1] }}>
      <Icon size={17} className="shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Count({ label, value, color }) {
  return (
    <div className="rounded-xl px-3 py-2 text-center min-w-[4.5rem]" style={{ background: "var(--color-surface-sunken)" }}>
      <div className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>{label}</div>
      <div className="text-lg font-bold tabular-nums" style={{ color: color || "var(--color-text-primary)" }}>{value}</div>
    </div>
  );
}

function Line({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b text-sm" style={{ borderColor: "var(--color-border-subtle)" }}>
      <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
      <span className="font-medium text-right" style={{ color: "var(--color-text-primary)" }}>{value}</span>
    </div>
  );
}

function StudentRow({ s, status, disabled, changed, onChange }) {
  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3 border-b last:border-0"
      style={{ borderColor: "var(--color-border-subtle)", background: changed ? "rgba(59,130,246,0.06)" : undefined }}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="w-9 text-xs font-mono shrink-0 tabular-nums" style={{ color: "var(--color-text-muted)" }}>
          {s.rollNumber || "—"}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate" style={{ color: "var(--color-text-primary)" }}>{s.studentName}</div>
          <div className="text-[11px] truncate flex items-center gap-1" style={{ color: "var(--color-text-muted)" }}>
            {s.admissionNumber || s.studentId}
            {s.onApprovedLeave && (
              <span className="inline-flex items-center gap-0.5 font-semibold" style={{ color: "var(--color-warning)" }}>
                · <Lock size={10} /> approved leave
              </span>
            )}
            {!s.recordId && status === null && <span>· not marked</span>}
          </div>
        </div>
      </div>
      <StatusToggle value={status} onChange={onChange} disabled={disabled} studentName={s.studentName} />
    </div>
  );
}

/**
 * Mark or correct one register: academic year, class, section, subject,
 * date and period. Faculty see only their assigned classes and subjects;
 * Attendance Staff and Admin see all. The server re-checks everything.
 */
export default function Attendance() {
  const { user } = useAuth();
  const { push } = useToast();
  const [params] = useSearchParams();
  const { scope, error, reload } = useAcademicScope();

  const [filters, setFilters] = useState(() => ({
    academicYearId: params.get("academicYearId") || "",
    levelId: "",
    classId: params.get("classId") || "",
    streamId: "",
    courseId: params.get("courseId") || "",
    sectionId: params.get("sectionId") || "",
    subjectId: params.get("subject") || "",
  }));
  const [date, setDate] = useState(params.get("date") || todayLocal());
  const [period, setPeriod] = useState(params.get("period") || "");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [statuses, setStatuses] = useState({});
  const [mode, setMode] = useState(params.get("edit") === "1" ? "edit" : "view");
  const [reason, setReason] = useState("");
  const [overrideLeave, setOverrideLeave] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [allAbsentOpen, setAllAbsentOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);

  const ready = !!(filters.academicYearId && filters.classId && filters.subjectId && date && period);
  const query = useMemo(
    () => ({
      academicYearId: filters.academicYearId,
      classId: filters.classId,
      sectionId: filters.sectionId || "",
      subject: filters.subjectId,
      courseId: filters.courseId || "",
      date,
      period,
    }),
    [filters.academicYearId, filters.classId, filters.sectionId, filters.subjectId, filters.courseId, date, period]
  );

  const load = useCallback(() => {
    if (!ready) {
      setData(null);
      return;
    }
    setLoading(true);
    setLoadError("");
    client
      .get("/attendance/register", { params: query })
      .then(({ data: d }) => {
        setData(d);
        setStatuses(Object.fromEntries(d.students.map((s) => [s.studentId, s.status || null])));
        setReason("");
        setOverrideLeave(false);
        if (!d.exists) setMode("view");
      })
      .catch((e) => {
        setData(null);
        setLoadError(e.response?.data?.error || "Couldn't load the class list.");
      })
      .finally(() => setLoading(false));
  }, [ready, query]);

  useEffect(load, [load]);
  useEffect(() => setSaved(null), [query]);

  const students = useMemo(() => data?.students || [], [data]);
  const original = useMemo(() => Object.fromEntries(students.map((s) => [s.studentId, s.recordId ? s.status : null])), [students]);
  const editing = !!data?.exists && mode === "edit" && data.permissions.canEdit;
  const canInteract = !!data && (data.exists ? editing : data.permissions.canMark);
  const isLocked = (s) => s.locked && !(user.role === "Admin" && overrideLeave);

  const counts = useMemo(() => {
    const c = { total: students.length, present: 0, absent: 0, leave: 0, notMarked: 0 };
    students.forEach((s) => {
      const st = statuses[s.studentId];
      if (st === "Present") c.present += 1;
      else if (st === "Absent") c.absent += 1;
      else if (st === "Leave") c.leave += 1;
      else c.notMarked += 1;
    });
    return c;
  }, [students, statuses]);

  const changes = useMemo(
    () =>
      editing
        ? students
            .filter((s) => statuses[s.studentId] && statuses[s.studentId] !== original[s.studentId])
            .map((s) => ({ student: s.studentId, status: statuses[s.studentId] }))
        : [],
    [editing, students, statuses, original]
  );

  function setAll(status) {
    setStatuses((prev) => {
      const next = { ...prev };
      students.forEach((s) => {
        if (!isLocked(s)) next[s.studentId] = status;
      });
      return next;
    });
  }

  function openSave() {
    if (!data.exists && counts.notMarked) {
      push(`${counts.notMarked} student${counts.notMarked === 1 ? " has" : "s have"} no status yet.`, "error");
      return;
    }
    if (editing && changes.length === 0) {
      push("Nothing has changed yet.", "info");
      return;
    }
    if (editing && reason.trim().length < 3) {
      push("Give a reason for the correction.", "error");
      return;
    }
    setConfirmOpen(true);
  }

  async function doSave() {
    setSaving(true);
    try {
      if (!data.exists) {
        const records = students.map((s) => ({ student: s.studentId, status: statuses[s.studentId] }));
        const { data: r } = await client.post("/attendance", { ...query, records, overrideLeave });
        setSaved({ kind: "new", ...r });
        push("Attendance saved successfully.", "success");
      } else {
        const { data: r } = await client.put("/attendance/register", { ...query, changes, reason: reason.trim(), overrideLeave });
        setSaved({ kind: "edit", changed: r.changed, ...r.counts });
        push(`Attendance corrected — ${r.changed} change${r.changed === 1 ? "" : "s"} recorded.`, "success");
        setMode("view");
      }
      setConfirmOpen(false);
      load();
    } catch (e) {
      push(e.response?.data?.error || "Could not save attendance.", "error");
      if (e.response?.status === 409) {
        setConfirmOpen(false);
        load();
      }
    } finally {
      setSaving(false);
    }
  }

  if (error) return <ErrorState full message="Couldn't load the academic structure." onRetry={reload} />;
  if (!scope) return <Loader full label="Loading…" />;

  if (scope.teachable && scope.teachable.length === 0) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title={user.role === "Faculty" ? "No subjects assigned to you" : "Attendance marking is not enabled for your role"}
        description={
          user.role === "Faculty"
            ? "You can't mark attendance until an administrator assigns you a subject under Teaching Assignments."
            : "An administrator can allow Attendance Staff to mark attendance under Academic Policies."
        }
      />
    );
  }

  const periods = Array.from({ length: scope.settings.periodsPerDay || 8 }, (_, i) => String(i + 1));
  const selectedSubject = scope.subjects.find((s) => s.id === filters.subjectId);

  return (
    <div className="space-y-4 pb-24 sm:pb-6">
      <div className="glass rounded-2xl p-4 sm:p-5 space-y-3">
        <AcademicFilters scope={scope} value={filters} onChange={setFilters} />
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <div>
            <label htmlFor="att-date" className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>Date</label>
            <input id="att-date" type="date" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} className="input" />
          </div>
          <div>
            <label htmlFor="att-period" className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>Period</label>
            <select id="att-period" value={period} onChange={(e) => setPeriod(e.target.value)} className="input">
              <option value="">Select…</option>
              {periods.map((p) => <option key={p} value={p}>Period {p}</option>)}
            </select>
          </div>
        </div>
      </div>

      {!ready ? (
        <EmptyState icon={CalendarCheck} title="Choose a register" description="Select the class, subject, date and period to load the students." />
      ) : loading && !data ? (
        <Loader label="Loading class list…" />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : data ? (
        <>
          {saved && (
            <Banner tone="success" icon={CheckCircle2}>
              <strong>{saved.kind === "new" ? "ATTENDANCE SAVED SUCCESSFULLY" : "ATTENDANCE CORRECTED"}</strong>
              <span className="block text-xs mt-0.5">
                {saved.kind === "new"
                  ? `${saved.present} present · ${saved.absent} absent · ${saved.leave} leave${saved.leaveForced?.length ? ` · ${saved.leaveForced.length} set to leave (approved leave)` : ""}`
                  : `${saved.changed} change${saved.changed === 1 ? "" : "s"} recorded in the correction history.`}
              </span>
            </Banner>
          )}

          {data.exists && (
            <Banner tone="info" icon={Lock}>
              <strong>Attendance already recorded for this class, subject, date and period.</strong>
              <span className="block text-xs mt-0.5">
                Taken by {data.meta.takenByName || "—"} ({data.meta.takenByRole}) on {fmtTime(data.meta.takenAt)}
                {data.meta.updatedAt ? ` · last corrected by ${data.meta.updatedByName} on ${fmtTime(data.meta.updatedAt)}` : ""}
              </span>
              <div className="flex flex-wrap gap-2 mt-2.5">
                <Button size="sm" variant={mode === "view" ? "primary" : "secondary"} icon={Eye} onClick={() => { setMode("view"); load(); }}>
                  View Existing Attendance
                </Button>
                {data.permissions.canEdit ? (
                  <Button size="sm" variant={mode === "edit" ? "primary" : "secondary"} icon={Pencil} onClick={() => setMode("edit")}>
                    Edit Attendance
                  </Button>
                ) : (
                  data.permissions.editError && <span className="text-xs self-center">{data.permissions.editError}</span>
                )}
              </div>
            </Banner>
          )}

          {!data.exists && !data.permissions.canMark && data.permissions.markError && (
            <Banner tone="warning">{data.permissions.markError}</Banner>
          )}
          {data.conflict && (
            <Banner tone="warning">
              Some of these students are already marked for {data.meta.subjectName} in period {period} on another register
              (for example the whole class instead of one section). Saving here would duplicate them, so it will be refused.
            </Banner>
          )}

          {students.length === 0 ? (
            <EmptyState
              icon={AlertTriangle}
              title="No students take this subject here"
              description={`No active student in ${data.meta.className}${data.meta.sectionName ? ` ${data.meta.sectionName}` : ""} has ${selectedSubject?.name || "this subject"} in their combination or program.`}
            />
          ) : (
            <div className="glass rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b flex flex-wrap items-center gap-3" style={{ borderColor: "var(--color-border-subtle)" }}>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate" style={{ color: "var(--color-text-primary)" }}>
                    {data.meta.subjectName} — {data.meta.className}{data.meta.sectionName ? ` ${data.meta.sectionName}` : ""}
                  </div>
                  <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {fmtDate(date)} · Period {period} · {data.meta.academicYearLabel}
                  </div>
                </div>
                {canInteract && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" icon={CheckCheck} onClick={() => setAll("Present")}>Mark All Present</Button>
                    <Button size="sm" variant="secondary" icon={UserX} onClick={() => setAllAbsentOpen(true)}>Mark All Absent</Button>
                  </div>
                )}
              </div>
              <div className="px-4 py-3 flex flex-wrap gap-2 border-b" style={{ borderColor: "var(--color-border-subtle)" }}>
                <Count label="Total" value={counts.total} />
                <Count label="Present" value={counts.present} color="var(--color-success)" />
                <Count label="Absent" value={counts.absent} color="var(--color-danger)" />
                <Count label="Leave" value={counts.leave} color="var(--color-warning)" />
                {counts.notMarked > 0 && <Count label="Not marked" value={counts.notMarked} color="var(--color-text-muted)" />}
              </div>
              {user.role === "Admin" && canInteract && students.some((s) => s.onApprovedLeave) && (
                <label className="flex items-center gap-2 px-4 py-2.5 text-xs border-b cursor-pointer" style={{ borderColor: "var(--color-border-subtle)", color: "var(--color-text-secondary)" }}>
                  <input type="checkbox" checked={overrideLeave} onChange={(e) => setOverrideLeave(e.target.checked)} />
                  Override approved leave (administrator only)
                </label>
              )}
              <div>
                {students.map((s) => (
                  <StudentRow
                    key={s.studentId}
                    s={s}
                    status={statuses[s.studentId]}
                    changed={editing && statuses[s.studentId] !== original[s.studentId]}
                    disabled={!canInteract || isLocked(s)}
                    onChange={(st) => setStatuses((m) => ({ ...m, [s.studentId]: st }))}
                  />
                ))}
              </div>
              {editing && (
                <div className="p-4 border-t" style={{ borderColor: "var(--color-border-subtle)" }}>
                  <label htmlFor="att-reason" className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>
                    Reason for correction <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="att-reason"
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Medical certificate verified"
                    className="input"
                    maxLength={300}
                  />
                  <p className="text-[11px] mt-1" style={{ color: "var(--color-text-muted)" }}>
                    {changes.length} change{changes.length === 1 ? "" : "s"} · every change is recorded with your name, the time and this reason.
                  </p>
                </div>
              )}
            </div>
          )}

          {canInteract && students.length > 0 && (
            <div
              className="fixed sm:static bottom-0 inset-x-0 z-20 p-3 sm:p-0 border-t sm:border-0 flex justify-end"
              style={{ background: "var(--color-surface-overlay)", borderColor: "var(--color-border-subtle)" }}
            >
              <Button icon={Save} onClick={openSave} className="w-full sm:w-auto">
                {editing ? "Save Corrections" : "Save Attendance"}
              </Button>
            </div>
          )}
        </>
      ) : null}

      <Modal open={confirmOpen} onClose={() => !saving && setConfirmOpen(false)} title={editing ? "Confirm correction" : "Confirm attendance"}>
        {data && (
          <div className="space-y-4">
            <div>
              <Line label="Class" value={data.meta.className} />
              <Line label="Section" value={data.meta.sectionName || "Whole class"} />
              <Line label="Subject" value={data.meta.subjectName} />
              <Line label="Date" value={fmtDate(date)} />
              <Line label="Period" value={period} />
              <Line label={editing ? "Corrected by" : "Faculty / taken by"} value={user.name} />
              <Line label="Number of students" value={counts.total} />
              <Line label="Present" value={counts.present} />
              <Line label="Absent" value={counts.absent} />
              <Line label="Leave" value={counts.leave} />
              {editing && <Line label="Changes" value={changes.length} />}
              {editing && <Line label="Reason" value={reason} />}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmOpen(false)} disabled={saving}>Back</Button>
              <Button className="flex-1" icon={Save} loading={saving} onClick={doSave}>
                {editing ? "SAVE CORRECTIONS" : "SAVE ATTENDANCE"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={allAbsentOpen}
        onClose={() => setAllAbsentOpen(false)}
        onConfirm={() => { setAll("Absent"); setAllAbsentOpen(false); }}
        title="Mark everyone absent?"
        message="Every student on this register (except those on approved leave) will be set to Absent. You can still change individual students before saving."
      />
    </div>
  );
}
