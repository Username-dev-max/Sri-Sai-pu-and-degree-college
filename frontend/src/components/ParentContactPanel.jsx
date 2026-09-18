import { useCallback, useEffect, useState } from "react";
import { Phone, MessageSquare, MessageCircle, History, ShieldAlert, Clock } from "lucide-react";
import client from "../api/client";
import { useToast } from "../context/ToastContext";
import Loader from "./Loader";
import Button from "./Button";
import StatusBadge from "./StatusBadge";

const TYPE_LABEL = { CALL: "Call", SMS: "SMS", WHATSAPP: "WhatsApp", AI_CALL: "AI call (manual record)" };

/** Indian numbers are dialled as +91 when stored as ten digits. */
function international(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

/**
 * Parent contact for an absent student, plus the follow-up record.
 *
 * Honest by design: the buttons open this device's own dialler, SMS app or
 * WhatsApp with the number and a prepared message. The college system does
 * not place calls or send messages itself, and says so. The comment box
 * unlocks 30 seconds after the follow-up starts — the server enforces that.
 */
export default function ParentContactPanel({ studentId, date, subjectId }) {
  const { push } = useToast();
  const [contact, setContact] = useState(null);
  const [error, setError] = useState("");
  const [followup, setFollowup] = useState(null);
  const [minSeconds, setMinSeconds] = useState(30);
  const [remaining, setRemaining] = useState(0);
  const [comment, setComment] = useState("");
  const [parentResponse, setParentResponse] = useState("");
  const [absenceReason, setAbsenceReason] = useState("");
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);

  const loadHistory = useCallback(() => {
    client
      .get("/call-followups", { params: { studentId } })
      .then(({ data }) => setHistory(data.followups || []))
      .catch(() => setHistory([]));
  }, [studentId]);

  useEffect(() => {
    setContact(null);
    setError("");
    setFollowup(null);
    client
      .get(`/call-followups/contact/${studentId}`, { params: { date, subjectId } })
      .then(({ data }) => setContact(data))
      .catch((e) => setError(e.response?.data?.error || "Couldn't load the parent contact."));
    loadHistory();
  }, [studentId, date, subjectId, loadHistory]);

  // Countdown from the SERVER's start time.
  useEffect(() => {
    if (!followup || followup.status === "COMPLETED") return undefined;
    const tick = () => {
      const elapsed = (Date.now() - new Date(followup.startedAt).getTime()) / 1000;
      setRemaining(Math.max(0, Math.ceil(minSeconds - elapsed)));
    };
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [followup, minSeconds]);

  async function start(type) {
    if (!contact?.hasPhone) return;
    try {
      const { data } = await client.post("/call-followups/start", { studentId, type, attendanceDate: date || "", subjectId: subjectId || "" });
      setFollowup(data.followup);
      setMinSeconds(data.minSeconds || 30);
      setComment("");
      setParentResponse("");
      setAbsenceReason("");
      setFollowUpRequired(false);
      const phone = international(contact.guardianPhone);
      const text = encodeURIComponent(contact.message);
      if (type === "CALL") window.location.href = `tel:+${phone}`;
      if (type === "SMS") window.location.href = `sms:+${phone}?&body=${text}`;
      if (type === "WHATSAPP") window.open(`https://wa.me/${phone}?text=${text}`, "_blank", "noopener,noreferrer");
      loadHistory();
    } catch (e) {
      push(e.response?.data?.error || "Could not start the follow-up.", "error");
    }
  }

  async function saveComment() {
    setSaving(true);
    try {
      const { data } = await client.patch(`/call-followups/${followup.id}/comment`, { comment, parentResponse, absenceReason, followUpRequired });
      setFollowup(data.followup);
      push("Follow-up saved.", "success");
      loadHistory();
    } catch (e) {
      push(e.response?.data?.error || "Could not save the comment.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (error) return <p className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>;
  if (!contact) return <Loader label="Loading parent contact…" />;

  const locked = followup && followup.status !== "COMPLETED" && remaining > 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-3.5 space-y-1.5" style={{ background: "var(--color-surface-sunken)" }}>
        <div className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>{contact.studentName}</div>
        <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          Parent / guardian: <strong>{contact.guardianName || "Not recorded"}</strong>
        </div>
        <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          Contact: <strong className="font-mono">{contact.guardianPhone || "No number on record"}</strong>
        </div>
      </div>

      <div className="rounded-xl p-3 text-xs" style={{ background: "rgba(59,130,246,0.08)", color: "var(--color-text-secondary)" }}>
        {contact.message}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Button icon={Phone} onClick={() => start("CALL")} disabled={!contact.hasPhone || !!locked}>Call Parent</Button>
        <Button variant="secondary" icon={MessageSquare} onClick={() => start("SMS")} disabled={!contact.hasPhone || !!locked}>Send SMS</Button>
        <Button variant="secondary" icon={MessageCircle} onClick={() => start("WHATSAPP")} disabled={!contact.hasPhone || !!locked}>Send WhatsApp</Button>
      </div>
      <p className="flex items-start gap-1.5 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
        <ShieldAlert size={12} className="shrink-0 mt-px" />
        These open your own phone, SMS or WhatsApp app. The college system does not place calls or send messages, and no
        automated or AI calling takes place. Viewing this number is recorded in the audit log.
      </p>

      {followup && (
        <div className="rounded-xl border p-3.5 space-y-3" style={{ borderColor: "var(--color-border-default)" }}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              {TYPE_LABEL[followup.type]} follow-up started
            </span>
            {followup.status === "COMPLETED" ? (
              <StatusBadge tone="success">Saved</StatusBadge>
            ) : locked ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--color-warning)" }}>
                <Clock size={13} /> Comment in {remaining}s
              </span>
            ) : (
              <StatusBadge tone="info">Add comment</StatusBadge>
            )}
          </div>
          {followup.status !== "COMPLETED" && (
            <>
              <textarea
                rows={3}
                className="input"
                placeholder="What was discussed?"
                value={comment}
                disabled={locked}
                onChange={(e) => setComment(e.target.value)}
                aria-label="Follow-up comment"
              />
              <div className="grid sm:grid-cols-2 gap-2">
                <input className="input" placeholder="Parent's response" value={parentResponse} disabled={locked} onChange={(e) => setParentResponse(e.target.value)} aria-label="Parent response" />
                <input className="input" placeholder="Reason for absence" value={absenceReason} disabled={locked} onChange={(e) => setAbsenceReason(e.target.value)} aria-label="Reason for absence" />
              </div>
              <label className="flex items-center gap-2 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                <input type="checkbox" checked={followUpRequired} disabled={locked} onChange={(e) => setFollowUpRequired(e.target.checked)} />
                Further follow-up needed
              </label>
              <Button onClick={saveComment} loading={saving} disabled={locked || !comment.trim()} className="w-full">
                Save Comment
              </Button>
            </>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center gap-1.5 text-xs font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>
          <History size={13} /> Follow-up history
        </div>
        {history.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>No follow-ups recorded for this student.</p>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {history.map((h) => (
              <div key={h.id} className="rounded-lg p-2.5 text-xs" style={{ background: "var(--color-surface-sunken)" }}>
                <div className="flex flex-wrap justify-between gap-2" style={{ color: "var(--color-text-secondary)" }}>
                  <span><strong>{TYPE_LABEL[h.type] || h.type}</strong> by {h.callerName}</span>
                  <span>{new Date(h.startedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                </div>
                <p className="mt-1" style={{ color: "var(--color-text-primary)" }}>{h.comment || "No comment recorded."}</p>
                {(h.parentResponse || h.absenceReason) && (
                  <p className="mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                    {h.parentResponse && `Response: ${h.parentResponse}. `}
                    {h.absenceReason && `Reason: ${h.absenceReason}.`}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
