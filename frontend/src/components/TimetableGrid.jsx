import { motion } from "framer-motion";
import { CalendarDays } from "lucide-react";
import { useData } from "../context/DataContext";
import TiltCard from "./TiltCard";
import EmptyState from "./EmptyState";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default function TimetableGrid({ entries }) {
  const { subjectName, facultyName } = useData();
  const slots = [...new Set(entries.map((e) => e.time))].sort();

  if (!entries.length) {
    return <EmptyState icon={CalendarDays} title="No timetable entries yet." />;
  }

  return (
    <TiltCard intensity={1} className="glass rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-white bg-blue-600">Time</th>
              {DAYS.map((d) => (
                <th key={d} className="px-4 py-3 text-left font-semibold text-white bg-blue-600">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map((slot, si) => (
              <motion.tr
                key={slot}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: si * 0.05 }}
                style={{ background: si % 2 === 0 ? "var(--color-surface-raised)" : "var(--color-surface-sunken)" }}
              >
                <td className="px-4 py-3 font-semibold whitespace-nowrap" style={{ color: "var(--color-text-secondary)" }}>{slot}</td>
                {DAYS.map((day) => {
                  const cell = entries.find((e) => e.day === day && e.time === slot);
                  return (
                    <td key={day} className="px-4 py-3" style={{ color: "var(--color-text-secondary)" }}>
                      {cell ? (
                        <div>
                          <div className="font-medium" style={{ color: "var(--color-text-primary)" }}>{subjectName(cell.subject)}</div>
                          <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{facultyName(cell.faculty)} · {cell.room}</div>
                        </div>
                      ) : (
                        <span style={{ color: "var(--color-text-muted)" }}>—</span>
                      )}
                    </td>
                  );
                })}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </TiltCard>
  );
}
