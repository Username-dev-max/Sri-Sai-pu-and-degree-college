import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, X, Save, AlertTriangle, Users } from "lucide-react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useToast } from "../context/ToastContext";
import TiltCard from "../components/TiltCard";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import Button from "../components/Button";
import { Table, TableHead, TableTh, TableBody, TableTd } from "../components/Table";

/**
 * Faculty mark attendance for the subjects assigned to them; Attendance Staff
 * mark it for any subject, so they render this same screen with `allSubjects`.
 */
export default function Attendance({ allSubjects = false }) {
  const { user } = useAuth();
  const { subjects } = useData();
  const { push } = useToast();
  const mySubjects = useMemo(
    () => (allSubjects ? subjects : subjects.filter((s) => s.faculty === user.linkedId)),
    [subjects, user.linkedId, allSubjects]
  );

  const [subject, setSubject] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [students, setStudents] = useState([]);
  const [statusMap, setStatusMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mySubjects.length && !subject) setSubject(mySubjects[0].id);
  }, [mySubjects, subject]);

  useEffect(() => {
    if (!subject) return;
    const sub = subjects.find((s) => s.id === subject);
    if (!sub) return;
    setLoading(true);
    Promise.all([
      client.get("/students", { params: { course: sub.course } }),
      client.get(`/attendance/subject/${subject}`, { params: { date } }),
    ])
      .then(([stuRes, attRes]) => {
        const list = stuRes.data.students.filter((s) => s.semester === sub.semester);
        setStudents(list);
        const map = {};
        list.forEach((s) => { map[s.id] = "Present"; });
        attRes.data.attendance.forEach((a) => { map[a.student] = a.status; });
        setStatusMap(map);
      })
      .finally(() => setLoading(false));
  }, [subject, date, subjects]);

  function toggle(studentId, status) {
    setStatusMap((m) => ({ ...m, [studentId]: status }));
  }

  async function save() {
    setSaving(true);
    try {
      const records = students.map((s) => ({ student: s.id, status: statusMap[s.id] || "Absent" }));
      await client.post("/attendance", { subject, date, records });
      push("Attendance saved successfully.", "success");
    } catch (e) {
      push(e.response?.data?.error || "Could not save attendance.", "error");
    } finally {
      setSaving(false);
    }
  }

  const belowCount = students.filter((s) => statusMap[s.id] === "Absent").length;

  return (
    <div>
      <TiltCard intensity={1.5} className="glass rounded-2xl p-5 shadow-sm mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Subject</label>
            <select value={subject} onChange={(e) => setSubject(e.target.value)} className="input">
              {mySubjects.map((s) => <option key={s.id} value={s.id}>{s.name} (Sem {s.semester})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
          </div>
          <div className="flex items-end">
            <Button icon={Save} onClick={save} loading={saving} disabled={!students.length} className="w-full">
              Save Attendance
            </Button>
          </div>
        </div>
      </TiltCard>

      <TiltCard intensity={1.5} className="glass rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <Loader label="Loading class list…" />
        ) : students.length === 0 ? (
          <EmptyState icon={Users} title="No students found for this subject." />
        ) : (
          <Table>
            <TableHead>
              <TableTh>Student ID</TableTh>
              <TableTh>Name</TableTh>
              <TableTh align="right" className="text-center">Present</TableTh>
              <TableTh align="right" className="text-center">Absent</TableTh>
            </TableHead>
            <TableBody>
              {students.map((s, i) => {
                const status = statusMap[s.id];
                return (
                  <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}
                    className="border-b border-[var(--color-border-subtle)] last:border-0">
                    <TableTd className="font-mono text-xs" style={{ color: "var(--color-text-muted)" }}>{s.id}</TableTd>
                    <TableTd className="font-medium" style={{ color: "var(--color-text-primary)" }}>{s.name}</TableTd>
                    <TableTd className="text-center">
                      <motion.button whileTap={{ scale: 0.85 }} onClick={() => toggle(s.id, "Present")}
                        aria-label={`Mark ${s.name} present`} aria-pressed={status === "Present"}
                        className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center mx-auto transition-colors ${status === "Present" ? "bg-green-500 border-green-500 text-white" : "border-slate-200 text-transparent hover:border-green-300"}`}>
                        <Check size={16} />
                      </motion.button>
                    </TableTd>
                    <TableTd className="text-center">
                      <motion.button whileTap={{ scale: 0.85 }} onClick={() => toggle(s.id, "Absent")}
                        aria-label={`Mark ${s.name} absent`} aria-pressed={status === "Absent"}
                        className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center mx-auto transition-colors ${status === "Absent" ? "bg-red-500 border-red-500 text-white" : "border-slate-200 text-transparent hover:border-red-300"}`}>
                        <X size={16} />
                      </motion.button>
                    </TableTd>
                  </motion.tr>
                );
              })}
            </TableBody>
          </Table>
        )}
        {belowCount > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-2 text-xs text-amber-600 font-medium">
            <AlertTriangle size={14} /> {belowCount} student{belowCount > 1 ? "s" : ""} marked absent today
          </div>
        )}
      </TiltCard>
    </div>
  );
}
