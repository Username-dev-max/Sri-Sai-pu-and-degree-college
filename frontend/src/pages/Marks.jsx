import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Save, Award } from "lucide-react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useToast } from "../context/ToastContext";
import TiltCard from "../components/TiltCard";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";
import { Table, TableHead, TableTh, TableBody, TableTd } from "../components/Table";

const MAX = { internal: 25, assignment: 10, practical: 20, exam: 45 };

function gradeFor(pct) {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  return "F";
}
function gradeTone(g) {
  if (g === "F") return "danger";
  if (g === "A+" || g === "A") return "success";
  return "info";
}

export default function Marks() {
  const { user } = useAuth();
  const { subjects } = useData();
  const { push } = useToast();
  const mySubjects = useMemo(() => subjects.filter((s) => s.faculty === user.linkedId), [subjects, user.linkedId]);

  const [subject, setSubject] = useState("");
  const [students, setStudents] = useState([]);
  const [rows, setRows] = useState({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);

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
      client.get(`/marks/subject/${subject}`),
    ])
      .then(([stuRes, markRes]) => {
        const list = stuRes.data.students.filter((s) => s.semester === sub.semester);
        setStudents(list);
        const map = {};
        list.forEach((s) => { map[s.id] = { internal: "", assignment: "", practical: "", exam: "" }; });
        markRes.data.marks.forEach((m) => {
          map[m.student] = { internal: m.internal, assignment: m.assignment, practical: m.practical, exam: m.exam };
        });
        setRows(map);
      })
      .finally(() => setLoading(false));
  }, [subject, subjects]);

  function update(studentId, field, value) {
    const num = value === "" ? "" : Math.max(0, Math.min(MAX[field], Number(value)));
    setRows((r) => ({ ...r, [studentId]: { ...r[studentId], [field]: num } }));
  }

  function totals(row) {
    const total = ["internal", "assignment", "practical", "exam"].reduce((a, k) => a + (Number(row?.[k]) || 0), 0);
    const maxTotal = MAX.internal + MAX.assignment + MAX.practical + MAX.exam;
    const pct = Math.round((total / maxTotal) * 1000) / 10;
    return { total, pct, grade: gradeFor(pct) };
  }

  async function saveRow(studentId) {
    setSavingId(studentId);
    try {
      const row = rows[studentId];
      await client.post("/marks", { student: studentId, subject, ...row });
      push("Marks saved.", "success");
    } catch (e) {
      push(e.response?.data?.error || "Could not save marks.", "error");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div>
      <TiltCard intensity={1.5} className="glass rounded-2xl p-5 shadow-sm mb-5">
        <label className="block text-xs font-medium text-slate-500 mb-1">Subject</label>
        <select value={subject} onChange={(e) => setSubject(e.target.value)} className="input max-w-sm">
          {mySubjects.map((s) => <option key={s.id} value={s.id}>{s.name} (Sem {s.semester})</option>)}
        </select>
      </TiltCard>

      <TiltCard intensity={1.5} className="glass rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <Loader label="Loading marks…" />
        ) : students.length === 0 ? (
          <EmptyState icon={Award} title="No students found for this subject." />
        ) : (
          <Table>
            <TableHead>
              <TableTh>Student</TableTh>
              <TableTh className="text-center">Internal /25</TableTh>
              <TableTh className="text-center">Assignment /10</TableTh>
              <TableTh className="text-center">Practical /20</TableTh>
              <TableTh className="text-center">Exam /45</TableTh>
              <TableTh className="text-center">Total</TableTh>
              <TableTh className="text-center">Grade</TableTh>
              <TableTh />
            </TableHead>
            <TableBody>
              {students.map((s, i) => {
                const row = rows[s.id] || {};
                const { total, grade } = totals(row);
                return (
                  <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}
                    className="border-b border-[var(--color-border-subtle)] last:border-0">
                    <TableTd className="font-medium whitespace-nowrap" style={{ color: "var(--color-text-primary)" }}>{s.name}</TableTd>
                    {["internal", "assignment", "practical", "exam"].map((f) => (
                      <TableTd key={f}>
                        <input
                          type="number"
                          min={0}
                          max={MAX[f]}
                          value={row[f]}
                          onChange={(e) => update(s.id, f, e.target.value)}
                          className="input w-16 text-center px-2 py-1.5 mx-auto block"
                        />
                      </TableTd>
                    ))}
                    <TableTd className="text-center font-semibold" style={{ color: "var(--color-text-secondary)" }}>{total}</TableTd>
                    <TableTd className="text-center">
                      <StatusBadge tone={gradeTone(grade)}>{grade}</StatusBadge>
                    </TableTd>
                    <TableTd className="text-center">
                      <button
                        onClick={() => saveRow(s.id)}
                        disabled={savingId === s.id}
                        aria-label={`Save marks for ${s.name}`}
                        className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg disabled:opacity-50"
                      >
                        <Save size={15} />
                      </button>
                    </TableTd>
                  </motion.tr>
                );
              })}
            </TableBody>
          </Table>
        )}
      </TiltCard>
    </div>
  );
}
