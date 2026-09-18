import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Pencil, Phone, History } from "lucide-react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import useAcademicScope from "../hooks/useAcademicScope";
import AcademicFilters from "../components/AcademicFilters";
import ParentContactPanel from "../components/ParentContactPanel";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import Button from "../components/Button";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";
import { Table, TableHead, TableTh, TableBody, TableRow, TableTd } from "../components/Table";

const MARK_PATH = { Admin: "/admin/attendance", Faculty: "/faculty/attendance", "Attendance Staff": "/attendance-staff" };
const fmtDate = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "");
const pctText = (p) => (p === null || p === undefined ? "—" : `${p}%`);

function GroupList({ title, tone, items, onContact }) {
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--color-border-subtle)" }}>
      <div className="px-3 py-2 flex items-center justify-between" style={{ background: "var(--color-surface-sunken)" }}>
        <span className="text-xs font-semibold" style={{ color: "var(--color-text-primary)" }}>{title}</span>
        <StatusBadge tone={tone}>{items.length}</StatusBadge>
      </div>
      {items.length === 0 ? (
        <p className="px-3 py-3 text-xs" style={{ color: "var(--color-text-muted)" }}>None.</p>
      ) : (
        items.map((s) => (
          <div key={s.studentId} className="px-3 py-2 flex items-center gap-2 border-t text-sm" style={{ borderColor: "var(--color-border-subtle)" }}>
            <span className="w-8 text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>{s.rollNumber || "—"}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate" style={{ color: "var(--color-text-primary)" }}>{s.studentName}</div>
              <div className="text-[11px] truncate" style={{ color: "var(--color-text-muted)" }}>{s.admissionNumber || s.studentId}</div>
            </div>
            {onContact && (
              <Button size="sm" variant="secondary" icon={Phone} onClick={() => onContact(s)} disabled={!s.hasGuardianPhone}>
                {s.hasGuardianPhone ? "Contact" : "No number"}
              </Button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

/**
 * Attendance Management — every recorded register the user may see, with
 * who took it and when, present/absent/leave lists, parent contact for
 * absent students, and the correction history.
 */
export default function AttendanceRegisters() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { scope, error: scopeError, reload } = useAcademicScope();
  const [filters, setFilters] = useState({ academicYearId: "", levelId: "", classId: "", streamId: "", courseId: "", sectionId: "", subjectId: "" });
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(null);
  const [detail, setDetail] = useState(null);
  const [history, setHistory] = useState([]);
  const [contactFor, setContactFor] = useState(null);

  const load = useCallback(() => {
    setError(false);
    const params = { academicYearId: filters.academicYearId, classId: filters.classId, sectionId: filters.sectionId, subject: filters.subjectId, from, to };
    client
      .get("/attendance/sessions", { params })
      .then(({ data }) => setSessions(data.sessions))
      .catch(() => setError(true));
  }, [filters.academicYearId, filters.classId, filters.sectionId, filters.subjectId, from, to]);

  useEffect(() => {
    if (scope) load();
  }, [scope, load]);

  function openRegister(s) {
    setOpen(s);
    setDetail(null);
    setHistory([]);
    const params = { academicYearId: s.academicYearId, classId: s.classId, sectionId: s.sectionId, subject: s.subjectId, date: s.date, period: s.period };
    client.get("/attendance/session", { params }).then(({ data }) => setDetail(data)).catch(() => setDetail({ error: true }));
    client.get("/attendance/history", { params: { ...params, sectionId: s.sectionId || undefined } }).then(({ data }) => setHistory(data.history.filter((h) => String(h.period) === String(s.period) && (h.sectionId || "") === (s.sectionId || "")))).catch(() => setHistory([]));
  }

  function editRegister(s) {
    const q = new URLSearchParams({ academicYearId: s.academicYearId, classId: s.classId, sectionId: s.sectionId, subject: s.subjectId, date: s.date, period: s.period, edit: "1" });
    navigate(`${MARK_PATH[user.role]}?${q}`);
  }

  if (scopeError) return <ErrorState full message="Couldn't load the academic structure." onRetry={reload} />;
  if (!scope) return <Loader full label="Loading…" />;

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-4 sm:p-5 space-y-3">
        <AcademicFilters scope={scope} value={filters} onChange={setFilters} mode={user.role === "Faculty" ? "teach" : "any"} />
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <div>
            <label htmlFor="reg-from" className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>From</label>
            <input id="reg-from" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label htmlFor="reg-to" className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>To</label>
            <input id="reg-to" type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      {error ? (
        <ErrorState message="Couldn't load attendance registers." onRetry={load} />
      ) : !sessions ? (
        <Loader label="Loading registers…" />
      ) : sessions.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No attendance records available." description="No register has been recorded for these filters." />
      ) : (
        <div className="glass rounded-2xl overflow-hidden shadow-sm">
          <Table>
            <TableHead>
              <TableTh>Date</TableTh>
              <TableTh>Period</TableTh>
              <TableTh>Class</TableTh>
              <TableTh>Subject</TableTh>
              <TableTh>Taken By</TableTh>
              <TableTh>P / A / L</TableTh>
              <TableTh>%</TableTh>
              <TableTh align="right">Actions</TableTh>
            </TableHead>
            <TableBody>
              {sessions.map((s) => (
                <TableRow key={s.key}>
                  <TableTd>{fmtDate(s.date)}</TableTd>
                  <TableTd>{s.period || "—"}</TableTd>
                  <TableTd>{s.className}{s.sectionName ? ` ${s.sectionName}` : ""}</TableTd>
                  <TableTd className="font-medium">{s.subjectName}</TableTd>
                  <TableTd>
                    {s.takenByName}
                    <span className="block text-[11px]" style={{ color: "var(--color-text-muted)" }}>{fmtTime(s.takenAt)}</span>
                  </TableTd>
                  <TableTd className="tabular-nums">
                    {s.present} / {s.absent} / {s.leave}
                    {s.corrected && <span className="ml-1.5"><StatusBadge tone="warning">corrected</StatusBadge></span>}
                  </TableTd>
                  <TableTd>{pctText(s.percentage)}</TableTd>
                  <TableTd align="right">
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => openRegister(s)}>View</Button>
                      <Button size="sm" variant="secondary" icon={Pencil} onClick={() => editRegister(s)}>Edit</Button>
                    </div>
                  </TableTd>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Modal open={!!open} onClose={() => { setOpen(null); setContactFor(null); }} title="Attendance register" width="max-w-2xl">
        {open && (
          <div className="space-y-4">
            <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              <div className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
                {open.subjectName} — {open.className}{open.sectionName ? ` ${open.sectionName}` : ""}
              </div>
              {fmtDate(open.date)} · Period {open.period || "—"} · Taken by {open.takenByName} ({open.takenByRole}) at {fmtTime(open.takenAt)}
            </div>
            {!detail ? (
              <Loader label="Loading…" />
            ) : detail.error ? (
              <p className="text-sm" style={{ color: "var(--color-danger)" }}>Couldn't load this register.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 text-xs">
                  <StatusBadge tone="neutral">Total {detail.totals.total}</StatusBadge>
                  <StatusBadge tone="success">Present {detail.totals.present}</StatusBadge>
                  <StatusBadge tone="danger">Absent {detail.totals.absent}</StatusBadge>
                  <StatusBadge tone="warning">Leave {detail.totals.leave}</StatusBadge>
                  <StatusBadge tone="info">{pctText(detail.totals.percentage)}</StatusBadge>
                </div>
                <GroupList title="Absent" tone="danger" items={detail.absent} onContact={(s) => setContactFor(s)} />
                <GroupList title="Leave" tone="warning" items={detail.leave} />
                <GroupList title="Present" tone="success" items={detail.present} />
              </>
            )}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>
                <History size={13} /> Correction history
              </div>
              {history.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>No corrections have been made to this register.</p>
              ) : (
                <div className="space-y-1.5">
                  {history.map((h) => (
                    <div key={h.id} className="rounded-lg p-2.5 text-xs" style={{ background: "var(--color-surface-sunken)", color: "var(--color-text-secondary)" }}>
                      <strong style={{ color: "var(--color-text-primary)" }}>{h.studentName}</strong>: {h.oldStatus} → {h.newStatus} · {h.changedByName} ({h.changedByRole}) · {fmtTime(h.changedAt)}
                      {h.reason && <span className="block mt-0.5">Reason: {h.reason}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button variant="secondary" icon={Pencil} className="w-full" onClick={() => editRegister(open)}>Edit Attendance</Button>
          </div>
        )}
      </Modal>

      <Modal open={!!contactFor} onClose={() => setContactFor(null)} title="Parent contact" width="max-w-lg">
        {contactFor && open && <ParentContactPanel studentId={contactFor.studentId} date={open.date} subjectId={open.subjectId} />}
      </Modal>
    </div>
  );
}
