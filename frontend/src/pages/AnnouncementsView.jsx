import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Megaphone, Paperclip, CalendarDays } from "lucide-react";
import client from "../api/client";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import StatusBadge from "../components/StatusBadge";

const PRIORITY_TONE = { Urgent: "danger", High: "warning", Normal: "neutral" };

/**
 * Read-only announcements feed for Students, Parents, Faculty and Attendance
 * Staff. The server decides what this returns — an announcement addressed to
 * another audience never reaches the client at all, so there is nothing here
 * to filter or hide.
 */
export default function AnnouncementsView() {
  const [list, setList] = useState(null);
  const [error, setError] = useState(false);

  function load() {
    setError(false);
    client
      .get("/announcements")
      .then(({ data }) => setList(data.announcements))
      .catch(() => setError(true));
  }
  useEffect(load, []);

  if (error) return <ErrorState full message="Couldn't load announcements." onRetry={load} />;
  if (!list) return <Loader full label="Loading announcements…" />;

  if (list.length === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        title="No announcements"
        description="Announcements from the college office will appear here."
      />
    );
  }

  return (
    <div className="space-y-3 max-w-3xl">
      {list.map((a, i) => (
        <motion.article
          key={a.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i * 0.05, 0.3), duration: 0.35 }}
          className="glass glow-card rounded-2xl p-5 shadow-sm"
        >
          <div className="flex items-start gap-2 flex-wrap mb-1.5">
            <h3 className="font-semibold text-base" style={{ color: "var(--color-text-primary)" }}>{a.title}</h3>
            {a.priority !== "Normal" && <StatusBadge tone={PRIORITY_TONE[a.priority]}>{a.priority}</StatusBadge>}
            <StatusBadge tone="info">{a.category}</StatusBadge>
          </div>
          {a.body && (
            <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--color-text-secondary)" }}>
              {a.body}
            </p>
          )}
          <div className="flex items-center gap-4 mt-3 text-xs flex-wrap" style={{ color: "var(--color-text-muted)" }}>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={12} /> {a.publishDate}
            </span>
            <span>{a.postedBy}</span>
            {a.attachmentUrl && (
              <a
                href={a.attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-blue-600 font-medium"
              >
                <Paperclip size={12} /> {a.attachmentName || "Attachment"}
              </a>
            )}
          </div>
        </motion.article>
      ))}
    </div>
  );
}
