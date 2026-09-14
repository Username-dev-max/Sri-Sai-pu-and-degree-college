import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Megaphone } from "lucide-react";
import client from "../api/client";
import TiltCard from "../components/TiltCard";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";

export const CATEGORY_TONE = {
  Exam: "accent",
  Holiday: "success",
  Assignment: "info",
  Important: "danger",
  General: "neutral",
};

export default function NoticesView() {
  const [notices, setNotices] = useState(null);
  const [error, setError] = useState(false);

  function load() {
    setError(false);
    client.get("/notices").then(({ data }) => setNotices([...data.notices].reverse())).catch(() => setError(true));
  }

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorState full message="Couldn't load notices. Please check your connection and try again." onRetry={load} />;
  if (!notices) return <Loader full label="Loading notices…" />;
  if (notices.length === 0) return <EmptyState icon={Megaphone} title="No notices yet." description="Announcements from your college will show up here." />;

  return (
    <div className="space-y-3 max-w-3xl">
      {notices.map((n, i) => (
        <motion.div key={n.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
          <TiltCard intensity={2} className="glass rounded-2xl p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Megaphone size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-semibold text-slate-800">{n.title}</h3>
                  <StatusBadge tone={CATEGORY_TONE[n.category] || "neutral"}>{n.category}</StatusBadge>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{n.body}</p>
                <p className="text-xs text-slate-400 mt-2">{n.date} · {n.postedBy}</p>
              </div>
            </div>
          </TiltCard>
        </motion.div>
      ))}
    </div>
  );
}
