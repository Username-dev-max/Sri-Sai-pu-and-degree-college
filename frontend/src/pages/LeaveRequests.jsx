import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarOff, Plus, Paperclip, Check, X, Trash2, FileDown } from "lucide-react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { downloadFile, downloadError } from "../api/download";
import ChildSwitcher, { useLinkedChildren } from "../components/ChildSwitcher";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import Button from "../components/Button";
import Modal from "../components/Modal";
import Tabs from "../components/Tabs";
import StatusBadge from "../components/StatusBadge";

const TONE = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" };
const MAX_BYTES = 8 * 1024 * 1024;
const OK_TYPES = [".pdf", ".png", ".jpg", ".jpeg"];
const fmt = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

function RequestCard({ r, children }) {
  return (
    <div className="glass rounded-2xl p-4 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>{r.studentName}</div>
          <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {r.admissionNumber} · {r.className}{r.sectionName ? ` ${r.sectionName}` : ""} · {r.id}
          </div>
        </div>
        <StatusBadge tone={TONE[r.status]}>{r.status}</StatusBadge>
      </div>
      <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
        <strong>{fmt(r.fromDate)}</strong> to <strong>{fmt(r.toDate)}</strong>{r.subjectName ? ` · ${r.subjectName}` : " · all classes"}
      </div>
      <div className="text-sm" style={{ color: "var(--color-text-primary)" }}>{r.reason}</div>
      {r.description && <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{r.description}</div>}
      {r.status !== "PENDING" && (
        <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {r.status === "APPROVED" ? "Approved" : "Rejected"} by {r.decidedByName || "—"}{r.decisionComment ? `: ${r.decisionComment}` : ""}
        </div>
      )}
      {children}
    </div>
  );
}

/** Leave requests: students submit, class teachers / Admin decide, parents follow. */
export default function LeaveRequests() {
  const { user } = useAuth();
  const { push } = useToast();
  const linked = useLinkedChildren();
  const fileRef = useRef(null);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState("PENDING");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ fromDate: "", toDate: "", subjectId: "", reason: "", description: "" });
  const [attachment, setAttachment] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [decision, setDecision] = useState(null);
  const [comment, setComment] = useState("");

  const isStudent = user.role === "Student";
  const isStaff = user.role === "Faculty" || user.role === "Admin";

  const load = useCallback(() => {
    setError(false);
    client.get("/leave-requests").then(({ data }) => setRows(data.leaveRequests)).catch(() => setError(true));
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    if (!isStudent) return;
    Promise.all([client.get(`/students/${user.linkedId}`), client.get("/academic-config")])
      .then(([s, cfg]) => {
        const combo = cfg.data.combinations.find((c) => c.id === s.data.student.course);
        setSubjects((combo?.subjects || []).filter((x) => x.id));
      })
      .catch(() => setSubjects([]));
  }, [isStudent, user.linkedId]);

  async function pickFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
    if (!OK_TYPES.includes(ext)) {
      push("Attach a PDF, PNG or JPG file.", "error");
      return;
    }
    if (f.size > MAX_BYTES) {
      push("The file must be 8 MB or smaller.", "error");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const { data } = await client.post("/leave-requests/upload", fd);
      setAttachment(data);
    } catch (err) {
      push(err.response?.data?.error || "Could not upload the document.", "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (form.toDate < form.fromDate) return push("The To date cannot be before the From date.", "error");
    setSaving(true);
    try {
      await client.post("/leave-requests", { ...form, storedName: attachment?.storedName, originalName: attachment?.originalName });
      push("Leave request submitted to your class teacher.", "success");
      setFormOpen(false);
      setForm({ fromDate: "", toDate: "", subjectId: "", reason: "", description: "" });
      setAttachment(null);
      load();
    } catch (err) {
      push(err.response?.data?.error || "Could not submit the request.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function decide() {
    setSaving(true);
    try {
      const { data } = await client.patch(`/leave-requests/${decision.row.id}/decision`, { decision: decision.kind, comment });
      push(`Leave ${decision.kind === "APPROVED" ? "approved" : "rejected"}${data.attendanceConverted ? ` — ${data.attendanceConverted} absence(s) changed to leave` : ""}.`, "success");
      setDecision(null);
      setComment("");
      load();
    } catch (err) {
      push(err.response?.data?.error || "Could not record the decision.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function withdraw(r) {
    try {
      await client.delete(`/leave-requests/${r.id}`);
      push("Request withdrawn.", "success");
      load();
    } catch (err) {
      push(err.response?.data?.error || "Could not withdraw the request.", "error");
    }
  }

  async function doc(r) {
    try {
      await downloadFile(`/leave-requests/${r.id}/document`, {}, "leave-document");
    } catch (err) {
      push(await downloadError(err, "Could not download the document."), "error");
    }
  }

  if (error) return <ErrorState full message="Couldn't load leave requests." onRetry={load} />;
  if (!rows) return <Loader full label="Loading…" />;

  let visible = rows;
  if (user.role === "Parent") visible = rows.filter((r) => r.studentId === linked.activeId);
  if (isStaff) visible = tab === "ALL" ? rows : rows.filter((r) => r.status === tab);

  return (
    <div className="space-y-4 max-w-4xl">
      <ChildSwitcher linked={linked} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        {isStaff ? (
          <Tabs tabs={[{ key: "PENDING", label: "Pending" }, { key: "APPROVED", label: "Approved" }, { key: "REJECTED", label: "Rejected" }, { key: "ALL", label: "All" }]} active={tab} onChange={setTab} layoutId="leave-tabs" />
        ) : (
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            {isStudent ? "Requests go to your class teacher. Approved leave is shown as Leave in your attendance." : "Leave requests for your child."}
          </p>
        )}
        {isStudent && <Button icon={Plus} onClick={() => setFormOpen(true)}>New Leave Request</Button>}
      </div>
      {user.role === "Faculty" && (
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>You see requests from students of the classes you are class teacher of.</p>
      )}

      {visible.length === 0 ? (
        <EmptyState icon={CalendarOff} title="No leave requests." />
      ) : (
        <div className="space-y-3">
          {visible.map((r) => (
            <RequestCard key={r.id} r={r}>
              <div className="flex flex-wrap gap-2 pt-1">
                {r.hasDocument && <Button size="sm" variant="secondary" icon={FileDown} onClick={() => doc(r)}>Document</Button>}
                {isStaff && r.status === "PENDING" && (
                  <>
                    <Button size="sm" icon={Check} onClick={() => { setComment(""); setDecision({ row: r, kind: "APPROVED" }); }}>Approve</Button>
                    <Button size="sm" variant="danger" icon={X} onClick={() => { setComment(""); setDecision({ row: r, kind: "REJECTED" }); }}>Reject</Button>
                  </>
                )}
                {isStudent && r.status === "PENDING" && (
                  <Button size="sm" variant="secondary" icon={Trash2} onClick={() => withdraw(r)}>Withdraw</Button>
                )}
              </div>
            </RequestCard>
          ))}
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="New leave request">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="lv-from" className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>From date *</label>
              <input id="lv-from" type="date" required className="input" value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} />
            </div>
            <div>
              <label htmlFor="lv-to" className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>To date *</label>
              <input id="lv-to" type="date" required min={form.fromDate || undefined} className="input" value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} />
            </div>
          </div>
          <div>
            <label htmlFor="lv-subject" className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>Subject (optional)</label>
            <select id="lv-subject" className="input" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
              <option value="">All classes on these dates</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="lv-reason" className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>Reason *</label>
            <input id="lv-reason" required maxLength={120} className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          <div>
            <label htmlFor="lv-desc" className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>Details</label>
            <textarea id="lv-desc" rows={2} maxLength={500} className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button type="button" variant="secondary" size="sm" icon={Paperclip} loading={uploading} onClick={() => fileRef.current?.click()}>Attach document</Button>
            <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={pickFile} />
            <span className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>{attachment ? attachment.originalName : "Optional · PDF/PNG/JPG up to 8 MB"}</span>
          </div>
          <Button type="submit" loading={saving} className="w-full">Submit Request</Button>
        </form>
      </Modal>

      <Modal open={!!decision} onClose={() => setDecision(null)} title={decision?.kind === "APPROVED" ? "Approve leave" : "Reject leave"}>
        {decision && (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              {decision.row.studentName}: {fmt(decision.row.fromDate)} to {fmt(decision.row.toDate)}. {decision.kind === "APPROVED" && "Absences already recorded in this range will be changed to Leave, and the change is recorded in the attendance history."}
            </p>
            <textarea rows={2} className="input" placeholder="Comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} aria-label="Comment" />
            <Button className="w-full" variant={decision.kind === "APPROVED" ? "primary" : "danger"} loading={saving} onClick={decide}>
              {decision.kind === "APPROVED" ? "Approve" : "Reject"}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
