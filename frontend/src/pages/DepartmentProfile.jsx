import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Eye, Target } from "lucide-react";
import client from "../api/client";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";
import GlassFacultyCard from "../components/GlassFacultyCard";
import PublicNav from "../components/home/PublicNav";
import PublicFooter from "../components/home/PublicFooter";

export default function DepartmentProfile() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  function load() {
    setError(false);
    client
      .get("/public/overview")
      .then(({ data }) => setData(data))
      .catch(() => setError(true));
  }

  useEffect(load, [id]);

  const dept = data?.departments.find((d) => d.id === id);
  const deptFaculty = data?.faculty.filter((f) => f.department === id) || [];

  return (
    <div className="relative min-h-screen">
      <PublicNav collegeName={data?.college?.name} search="" onSearch={() => {}} />

      <section className="pt-32 pb-16 px-4 sm:px-6" style={{ background: "var(--color-surface-base)" }}>
        <div className="max-w-5xl mx-auto">
          <Link to="/departments" className="inline-flex items-center gap-1.5 text-sm font-medium mb-6" style={{ color: "var(--color-text-secondary)" }}>
            <ArrowLeft size={15} /> Back to Departments
          </Link>

          {error ? (
            <ErrorState message="Couldn't load this department." onRetry={load} />
          ) : !data ? (
            <Loader label="Loading department…" />
          ) : !dept ? (
            <ErrorState message="Department not found." />
          ) : (
            <>
              <h1 className="font-display text-3xl font-semibold" style={{ color: "var(--color-text-primary)" }}>{dept.name} Department</h1>
              <p className="text-sm mt-2" style={{ color: "var(--color-text-secondary)" }}>
                Head of Department: {dept.hod || "[ADD OFFICIAL INFORMATION]"}
              </p>

              <div className="grid sm:grid-cols-2 gap-5 mt-8">
                <div className="glow-card rounded-2xl p-6" style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-subtle)" }}>
                  <Eye size={18} className="text-blue-600 mb-3" />
                  <h3 className="font-semibold text-sm mb-1.5" style={{ color: "var(--color-text-primary)" }}>Vision</h3>
                  <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{dept.vision || "[ADD OFFICIAL VISION STATEMENT]"}</p>
                </div>
                <div className="glow-card rounded-2xl p-6" style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-subtle)" }}>
                  <Target size={18} className="text-blue-600 mb-3" />
                  <h3 className="font-semibold text-sm mb-1.5" style={{ color: "var(--color-text-primary)" }}>Mission</h3>
                  <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{dept.mission || "[ADD OFFICIAL MISSION STATEMENT]"}</p>
                </div>
              </div>

              <h2 className="font-semibold text-base mt-10 mb-4" style={{ color: "var(--color-text-primary)" }}>Faculty</h2>
              {deptFaculty.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No faculty assigned to this department yet.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                  {deptFaculty.map((f, i) => (
                    <GlassFacultyCard key={f.id} faculty={f} deptName={() => dept.name} delay={i * 0.05} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <PublicFooter college={data?.college || {}} />
    </div>
  );
}
