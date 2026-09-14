import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Plus, CalendarClock, CheckCircle2, Users } from "lucide-react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useToast } from "../context/ToastContext";
import Modal from "../components/Modal";
import TiltCard from "../components/TiltCard";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import Button from "../components/Button";

export default function Assignments() {
  const { user } = useAuth();
  const { subjects, subjectName } = useData();
  const { push } = useToast();
  const isStaff = user.role === "Admin" || user.role === "Faculty";
  const mySubjects = user.role === "Faculty" ? subjects.filter((s) => s.faculty === user.linkedId) : subjects;

  const [assignments, setAssignments] = useState(null);
  const [error, setError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", subject: "", deadline: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    setError(false);
    try {
      const { data } = await client.get("/assignments");
      setAssignments(data.assignments);
    } catch {
      setError(true);
    }
  }
  useEffect(() => { load(); }, []);

  async function submitAssignment(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await client.post("/assignments", { ...form, faculty: user.linkedId || subjects[0]?.faculty });
      push("Assignment created.", "success");
      setModalOpen(false);
      setForm({ title: "", description: "", subject: "", deadline: "" });
      load();
    } catch (e2) {
      push(e2.response?.data?.error || "Could not create assignment.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleStudentSubmit(id) {
    try {
      await client.post(`/assignments/${id}/submit`);
      push("Assignment submitted!", "success");
      load();
    } catch (e) {
      push(e.response?.data?.error || "Could not submit.", "error");
    }
  }

  if (error) return <ErrorState full message="Couldn't load assignments. Please check your connection and try again." onRetry={load} />;
  if (!assignments) return <Loader full label="Loading assignments…" />;

  return (
    <div>
      {isStaff && (
        <div className="flex justify-end mb-5">
          <Button icon={Plus} onClick={() => setModalOpen(true)}>
            New Assignment
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {assignments.map((a, i) => {
          const submitted = user.role === "Student" && a.submissions.includes(user.linkedId);
          return (
            <motion.div key={a.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <TiltCard intensity={2} className="glass rounded-2xl p-5 shadow-sm h-full flex flex-col">
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <FileText size={16} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-800 leading-snug">{a.title}</h3>
                    <p className="text-xs text-slate-400">{subjectName(a.subject)}</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 mb-3 flex-1">{a.description}</p>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                  <span className="flex items-center gap-1"><CalendarClock size={13} /> Due {a.deadline}</span>
                  {isStaff && <span className="flex items-center gap-1"><Users size={13} /> {a.submissions.length} submitted</span>}
                </div>
                {user.role === "Student" && (
                  submitted ? (
                    <div className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                      <CheckCircle2 size={15} /> Submitted
                    </div>
                  ) : (
                    <button onClick={() => handleStudentSubmit(a.id)} className="text-sm font-semibold text-blue-600 hover:bg-blue-50 py-2 rounded-lg">
                      Mark as Submitted
                    </button>
                  )
                )}
              </TiltCard>
            </motion.div>
          );
        })}
      </div>
      {assignments.length === 0 && <EmptyState icon={FileText} title="No assignments yet." />}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Assignment">
        <form onSubmit={submitAssignment} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Title</label>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Subject</label>
            <select required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="input">
              <option value="" disabled>Select…</option>
              {mySubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Deadline</label>
            <input required type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
            <textarea required rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" />
          </div>
          <Button type="submit" loading={saving} className="w-full">
            Create Assignment
          </Button>
        </form>
      </Modal>
    </div>
  );
}
