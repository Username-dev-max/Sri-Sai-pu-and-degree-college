import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Award } from "lucide-react";
import client from "../api/client";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import { Table, TableHead, TableTh, TableBody, TableRow, TableTd } from "../components/Table";
import CampusImage from "../components/CampusImage";
import PublicNav from "../components/home/PublicNav";
import PublicFooter from "../components/home/PublicFooter";

// The college's own published result posters — the source for the boards below.
const POSTERS = [
  { src: "/campus/toppers-2025.jpg", caption: "Results announcement — 2025 toppers across II PUC, BCA and B.Com" },
  { src: "/campus/toppers-degree-2025.jpg", caption: "Degree results announcement — Final Year BCA and B.Com toppers" },
];

export default function PublicAchievements() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  function load() {
    setError(false);
    client
      .get("/public/overview")
      .then(({ data }) => setData(data))
      .catch(() => setError(true));
  }

  useEffect(load, []);

  const merit = data?.academicMerit || [];
  // Toppers come from several exams/batches — group them so each batch reads
  // as its own honours board rather than one undifferentiated list.
  const groups = merit.reduce((acc, m) => {
    const key = m.examLabel || "Results";
    (acc[key] = acc[key] || []).push(m);
    return acc;
  }, {});
  const groupNames = Object.keys(groups);
  // The banner below is about one specific exam, so pin its eyebrow to that
  // batch instead of whichever group happens to come first.
  const examLabel = groupNames.find((g) => g.includes("April 2022"));

  return (
    <div className="relative min-h-screen">
      <PublicNav collegeName={data?.college?.name} search="" onSearch={() => {}} />

      <section className="pt-32 pb-16 px-4 sm:px-6 text-center bg-gradient-to-br from-[#0b1526] via-[#0f1e33] to-[#16294a]">
        <div className="max-w-3xl mx-auto">
          <Award size={32} className="mx-auto mb-4 text-amber-400" />
          {examLabel && <div className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-2">{examLabel}</div>}
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-white">
            1st Place in K.G.F. Taluk
          </h1>
          <p className="text-sm text-blue-100/70 mt-3 max-w-xl mx-auto">
            Sri Sai PU and Degree College secured the top rank in K.G.F. Taluk in the II PUC Annual Examination, April 2022.
          </p>
        </div>
      </section>

      <section className="px-4 sm:px-6 py-16" style={{ background: "var(--color-surface-base)" }}>
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-xl font-semibold mb-8 text-center" style={{ color: "var(--color-text-primary)" }}>
            Meritorious Students
          </h2>
          {error ? (
            <ErrorState message="Couldn't load achievement data." onRetry={load} />
          ) : !data ? (
            <Loader label="Loading…" />
          ) : merit.length === 0 ? (
            <EmptyState icon={Award} title="No academic achievements published yet." />
          ) : (
            <div className="space-y-10">
              {groupNames.map((group, gi) => (
                <motion.div
                  key={group}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-8%" }}
                  transition={{ delay: gi * 0.06, duration: 0.45 }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Award size={15} className="text-blue-600 shrink-0" />
                    <h3 className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>{group}</h3>
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      · {groups[group].length} student{groups[group].length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="glass glow-card rounded-2xl overflow-hidden shadow-sm">
                    <Table>
                      <TableHead>
                        <TableTh>Rank</TableTh>
                        <TableTh>Student Name</TableTh>
                        <TableTh align="right">Marks</TableTh>
                      </TableHead>
                      <TableBody>
                        {groups[group]
                          .slice()
                          .sort((a, b) => b.marks - a.marks)
                          .map((m, i) => (
                            <TableRow key={m.id}>
                              <TableTd>{i + 1}</TableTd>
                              <TableTd className="font-medium" style={{ color: "var(--color-text-primary)" }}>
                                {m.name}
                                {m.detail && (
                                  <span className="block text-xs font-normal mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                                    {m.detail}
                                  </span>
                                )}
                              </TableTd>
                              <TableTd align="right" className="font-semibold" style={{ color: "var(--color-brand-600)" }}>{m.marks}</TableTd>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
          <div className="mt-14">
            <h3 className="font-semibold text-sm mb-4 text-center" style={{ color: "var(--color-text-primary)" }}>
              Result Announcements
            </h3>
            <div className="grid sm:grid-cols-2 gap-5">
              {POSTERS.map((p, i) => (
                <motion.figure
                  key={p.src}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-8%" }}
                  transition={{ delay: i * 0.08, duration: 0.45 }}
                  className="glow-card glow-media rounded-2xl"
                >
                  <CampusImage
                    src={p.src}
                    alt={p.caption}
                    label="[RESULT POSTER]"
                    className="w-full aspect-[4/3]"
                    fit="contain"
                    glow
                  />
                  <figcaption className="text-xs mt-2.5 px-1" style={{ color: "var(--color-text-muted)" }}>
                    {p.caption}
                  </figcaption>
                </motion.figure>
              ))}
            </div>
          </div>

          <p className="text-xs mt-8 text-center" style={{ color: "var(--color-text-muted)" }}>
            Published result information from college records; it does not represent the current student database.
          </p>
        </div>
      </section>

      <PublicFooter college={data?.college || {}} />
    </div>
  );
}
