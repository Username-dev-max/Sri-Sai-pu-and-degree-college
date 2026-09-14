import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Users2 } from "lucide-react";
import client from "../api/client";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import GlassMemberCard from "../components/GlassMemberCard";
import PublicNav from "../components/home/PublicNav";
import PublicFooter from "../components/home/PublicFooter";

export default function TeamProfile() {
  const { id } = useParams();
  const [college, setCollege] = useState(null);
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState(null);
  const [error, setError] = useState(false);

  function load() {
    setError(false);
    setTeam(null);
    setMembers(null);
    client.get("/public/overview").then(({ data }) => setCollege(data.college));
    client
      .get(`/public/teams/${id}`)
      .then(({ data }) => {
        setTeam(data.team);
        setMembers(data.members);
      })
      .catch(() => setError(true));
  }

  useEffect(load, [id]);

  return (
    <div className="relative min-h-screen">
      <PublicNav collegeName={college?.name} search="" onSearch={() => {}} />

      <section className="pt-32 pb-16 px-4 sm:px-6" style={{ background: "var(--color-surface-base)" }}>
        <div className="max-w-6xl mx-auto">
          <Link to="/teams" className="inline-flex items-center gap-1.5 text-sm font-medium mb-6" style={{ color: "var(--color-text-secondary)" }}>
            <ArrowLeft size={15} /> Back to All Teams
          </Link>

          {error ? (
            <ErrorState message="Couldn't load this team." onRetry={load} />
          ) : !team ? (
            <Loader label="Loading team…" />
          ) : (
            <>
              <div className="flex items-center gap-4 mb-3">
                <div className="w-12 h-12 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center shrink-0">
                  <Users2 size={22} />
                </div>
                <div>
                  <h1 className="font-display text-2xl sm:text-3xl font-semibold" style={{ color: "var(--color-text-primary)" }}>{team.name}</h1>
                  <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>{members.length} member{members.length === 1 ? "" : "s"}</p>
                </div>
              </div>
              {team.description && (
                <p className="text-sm mt-4 max-w-2xl" style={{ color: "var(--color-text-secondary)" }}>{team.description}</p>
              )}

              <h2 className="font-semibold text-base mt-10 mb-5" style={{ color: "var(--color-text-primary)" }}>Team Members</h2>
              {members.length === 0 ? (
                <EmptyState icon={Users2} title="No members added yet" description="Team members will be added by the college administration." />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                  {members.map((m, i) => (
                    <GlassMemberCard key={m.id} member={m} delay={i * 0.05} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <PublicFooter college={college || {}} />
    </div>
  );
}
