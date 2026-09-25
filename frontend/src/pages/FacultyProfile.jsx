import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, UserRound, BadgeCheck, Building2, Briefcase } from "lucide-react";
import client from "../api/client";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";
import PublicNav from "../components/home/PublicNav";
import PublicFooter from "../components/home/PublicFooter";
import { publicText } from "../lib/display";

export default function FacultyProfile() {
  const { id } = useParams();
  const [college, setCollege] = useState(null);
  const [faculty, setFaculty] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    client.get("/public/overview").then(({ data }) => setCollege(data.college));
  }, []);

  function load() {
    setError(false);
    setFaculty(null);
    client
      .get(`/public/faculty/${id}`)
      .then(({ data }) => setFaculty(data.faculty))
      .catch(() => setError(true));
  }

  useEffect(load, [id]);

  return (
    <div className="relative min-h-screen">
      <PublicNav collegeName={college?.name} search="" onSearch={() => {}} />

      <section className="pt-32 pb-16 px-4 sm:px-6" style={{ background: "var(--color-surface-base)" }}>
        <div className="max-w-2xl mx-auto">
          <Link to="/faculty-directory" className="inline-flex items-center gap-1.5 text-sm font-medium mb-6" style={{ color: "var(--color-text-secondary)" }}>
            <ArrowLeft size={15} /> Back to Faculty
          </Link>

          {error ? (
            <ErrorState message="Couldn't load this faculty profile." onRetry={load} />
          ) : !faculty ? (
            <Loader label="Loading profile…" />
          ) : (
            <div className="glass glow-soft rounded-2xl p-8 text-center shadow-sm">
              {faculty.photoUrl ? (
                <img
                  src={faculty.photoUrl}
                  alt={faculty.name}
                  className="w-28 h-28 rounded-full mx-auto mb-4 object-cover"
                  style={{ border: "1px solid var(--color-border-subtle)" }}
                />
              ) : (
                <div
                  className="w-28 h-28 rounded-full mx-auto mb-4 flex items-center justify-center"
                  style={{ background: "var(--color-surface-sunken)", border: "1px dashed var(--color-border-default)" }}
                >
                  <UserRound size={40} style={{ color: "var(--color-text-muted)" }} />
                </div>
              )}
              <h1 className="font-display text-2xl font-semibold" style={{ color: "var(--color-text-primary)" }}>{faculty.name}</h1>
              <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>{publicText(faculty.designation, "")}</p>

              <div className="grid sm:grid-cols-3 gap-4 mt-8 text-left">
                <div className="glow-card rounded-xl p-4" style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-subtle)" }}>
                  <Building2 size={16} className="text-blue-600 mb-2" />
                  <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>Department</div>
                  <div className="text-sm font-semibold mt-0.5" style={{ color: "var(--color-text-primary)" }}>{publicText(faculty.departmentName)}</div>
                </div>
                <div className="glow-card rounded-xl p-4" style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-subtle)" }}>
                  <Briefcase size={16} className="text-blue-600 mb-2" />
                  <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>Experience</div>
                  <div className="text-sm font-semibold mt-0.5" style={{ color: "var(--color-text-primary)" }}>{publicText(faculty.experience)}</div>
                </div>
                <div className="glow-card rounded-xl p-4" style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-subtle)" }}>
                  <BadgeCheck size={16} className="text-blue-600 mb-2" />
                  <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>Qualification</div>
                  <div className="text-sm font-semibold mt-0.5" style={{ color: "var(--color-text-primary)" }}>{publicText(faculty.qualification)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <PublicFooter college={college || {}} />
    </div>
  );
}
