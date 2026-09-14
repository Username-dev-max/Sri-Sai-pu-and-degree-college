import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Award, Download } from "lucide-react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import TiltCard from "../components/TiltCard";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";

function gradeColor(g) {
  if (g === "F") return "text-red-600 bg-red-50";
  if (g === "A+" || g === "A") return "text-green-700 bg-green-50";
  return "text-blue-700 bg-blue-50";
}

export default function Results() {
  const { user } = useAuth();
  const { subjectName } = useData();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  function load() {
    setError(false);
    client.get(`/results/${user.linkedId}`).then(({ data }) => setData(data)).catch(() => setError(true));
  }

  useEffect(load, [user.linkedId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorState full message="Couldn't load your results. Please check your connection and try again." onRetry={load} />;
  if (!data) return <Loader full label="Loading results…" />;

  return (
    <div className="max-w-4xl">
      <TiltCard intensity={1.5} className="glass rounded-2xl p-5 shadow-sm mb-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 text-slate-800 font-bold text-lg">
              <Award size={20} className="text-blue-600" /> Overall Performance
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Percentage: <span className="font-semibold text-slate-700">{data.overallPercentage ?? "—"}%</span>
              {data.overallResult && (
                <span className={`ml-3 px-2 py-0.5 rounded-full text-xs font-bold ${data.overallResult === "Pass" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  {data.overallResult}
                </span>
              )}
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => window.print()}
            disabled={data.records.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={15} /> Download Marksheet
          </motion.button>
        </div>
      </TiltCard>

      <TiltCard intensity={1.5} className="glass rounded-2xl overflow-hidden shadow-sm">
        {data.records.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">Marks have not been published yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200/70">
                  <th className="px-4 py-3 font-semibold">Subject</th>
                  <th className="px-4 py-3 font-semibold text-center">Internal</th>
                  <th className="px-4 py-3 font-semibold text-center">Assignment</th>
                  <th className="px-4 py-3 font-semibold text-center">Practical</th>
                  <th className="px-4 py-3 font-semibold text-center">Exam</th>
                  <th className="px-4 py-3 font-semibold text-center">Total</th>
                  <th className="px-4 py-3 font-semibold text-center">Grade</th>
                </tr>
              </thead>
              <tbody>
                {data.records.map((r, i) => (
                  <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-800">{subjectName(r.subject)}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{r.internal}/{r.internalMax}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{r.assignment}/{r.assignmentMax}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{r.practical}/{r.practicalMax}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{r.exam}/{r.examMax}</td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-700">{r.total}/{r.maxTotal}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${gradeColor(r.grade)}`}>{r.grade}</span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TiltCard>
    </div>
  );
}
