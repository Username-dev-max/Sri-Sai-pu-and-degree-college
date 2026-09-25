import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, FileText, Download, UserRound, Building2, CalendarDays, Users2 } from "lucide-react";
import client from "../api/client";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";
import PublicNav from "../components/home/PublicNav";
import PublicFooter from "../components/home/PublicFooter";
import { publicText, isMissing } from "../lib/display";

/**
 * A single team member, for someone deciding whether to approach them.
 *
 * The resume is shown inline as well as offered as a download, because most
 * people want to read it before deciding, and asking them to download a file
 * first is friction. Where no resume has been uploaded the page says so
 * rather than showing an empty frame.
 */
export default function TeamMemberProfile() {
  const { id } = useParams();
  const [college, setCollege] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  function load() {
    setError(false);
    setData(null);
    client.get("/public/overview").then(({ data }) => setCollege(data.college)).catch(() => {});
    client
      .get(`/public/team-members/${id}`)
      .then(({ data }) => setData(data))
      .catch(() => setError(true));
  }
  useEffect(load, [id]);

  const member = data?.member;
  const team = data?.team;

  const Fact = ({ icon: Icon, label, value }) =>
    isMissing(value) ? null : (
      <div
        className="glow-card rounded-xl p-4"
        style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-subtle)" }}
      >
        <Icon size={16} className="text-blue-600 mb-2" />
        <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{label}</div>
        <div className="text-sm font-semibold mt-0.5 break-words" style={{ color: "var(--color-text-primary)" }}>
          {value}
        </div>
      </div>
    );

  return (
    <div className="relative min-h-screen">
      <PublicNav collegeName={college?.name} search="" onSearch={() => {}} />

      <section className="pt-32 pb-16 px-4 sm:px-6" style={{ background: "var(--color-surface-base)" }}>
        <div className="max-w-4xl mx-auto">
          <Link
            to={team ? `/teams/${team.id}` : "/teams"}
            className="inline-flex items-center gap-1.5 text-sm font-medium mb-6 min-h-[44px]"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <ArrowLeft size={15} /> {team ? `Back to ${team.name}` : "Back to teams"}
          </Link>

          {error ? (
            <ErrorState message="Couldn't load this profile." onRetry={load} />
          ) : !member ? (
            <Loader label="Loading profile…" />
          ) : (
            <>
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="glass glow-soft rounded-2xl p-6 sm:p-8 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-7">
                  {member.photoUrl ? (
                    <img
                      src={member.photoUrl}
                      alt={member.name}
                      className="w-32 h-32 rounded-2xl object-cover shrink-0"
                      style={{ border: "1px solid var(--color-border-subtle)" }}
                    />
                  ) : (
                    <div
                      className="w-32 h-32 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ background: "var(--color-surface-sunken)", border: "1px dashed var(--color-border-default)" }}
                    >
                      <UserRound size={44} style={{ color: "var(--color-text-muted)" }} />
                    </div>
                  )}

                  <div className="min-w-0 text-center sm:text-left flex-1">
                    <h1 className="font-display text-2xl sm:text-3xl font-semibold" style={{ color: "var(--color-text-primary)" }}>
                      {publicText(member.name)}
                    </h1>
                    {!isMissing(member.role) && (
                      <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>{member.role}</p>
                    )}
                    {team && (
                      <div
                        className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ background: "rgba(37,99,235,0.1)", color: "var(--color-brand-600)" }}
                      >
                        <Users2 size={12} /> {team.name}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 mt-4 justify-center sm:justify-start">
                      {!isMissing(member.email) && (
                        <a
                          href={`mailto:${member.email}`}
                          className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-xl text-sm font-semibold text-white transition-colors hover:brightness-110"
                          style={{ background: "#1d4ed8" }}
                        >
                          <Mail size={15} /> Contact
                        </a>
                      )}
                      {!isMissing(member.resumeUrl) && (
                        <a
                          href={member.resumeUrl}
                          download={member.resumeName || `${member.name}-resume.pdf`}
                          className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-xl text-sm font-semibold transition-colors"
                          style={{ background: "var(--color-surface-sunken)", border: "1px solid var(--color-border-default)", color: "var(--color-text-primary)" }}
                        >
                          <Download size={15} /> Download resume
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
                <Fact icon={Building2} label="Department" value={member.departmentName} />
                <Fact icon={CalendarDays} label="Year" value={member.year} />
                <Fact icon={Mail} label="Email" value={member.email} />
              </div>

              <h2 className="font-semibold text-base mt-10 mb-3" style={{ color: "var(--color-text-primary)" }}>
                Resume
              </h2>
              {isMissing(member.resumeUrl) ? (
                <div
                  className="rounded-2xl p-8 text-center"
                  style={{ background: "var(--color-surface-sunken)", border: "1px dashed var(--color-border-default)", color: "var(--color-text-muted)" }}
                >
                  <FileText size={26} className="mx-auto mb-3" />
                  <p className="text-sm">No resume has been uploaded for this member yet.</p>
                </div>
              ) : (
                <>
                  <div
                    className="rounded-2xl overflow-hidden"
                    style={{ border: "1px solid var(--color-border-subtle)", background: "var(--color-surface-sunken)" }}
                  >
                    {/* A PDF viewer is not available on every phone, so the
                        download button above is the reliable path and this is
                        the convenience. */}
                    <object data={member.resumeUrl} type="application/pdf" className="w-full h-[70vh] min-h-[420px]">
                      <div className="p-8 text-center">
                        <FileText size={26} className="mx-auto mb-3" style={{ color: "var(--color-text-muted)" }} />
                        <p className="text-sm mb-4" style={{ color: "var(--color-text-secondary)" }}>
                          Your browser cannot display the PDF here.
                        </p>
                        <a
                          href={member.resumeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-xl text-sm font-semibold text-white"
                          style={{ background: "#1d4ed8" }}
                        >
                          <FileText size={15} /> Open the resume
                        </a>
                      </div>
                    </object>
                  </div>
                  <p className="text-xs mt-2" style={{ color: "var(--color-text-muted)" }}>
                    {member.resumeName || "Resume"} — use Download above to keep a copy.
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </section>

      <PublicFooter college={college || {}} />
    </div>
  );
}
