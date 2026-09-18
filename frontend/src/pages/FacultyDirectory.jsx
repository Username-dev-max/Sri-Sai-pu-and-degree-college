import { useEffect, useState } from "react";
import { Search, SearchX } from "lucide-react";
import client from "../api/client";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";
import GlassFacultyCard from "../components/GlassFacultyCard";
import PublicNav from "../components/home/PublicNav";
import PublicFooter from "../components/home/PublicFooter";
import { publicText } from "../lib/display";

export default function FacultyDirectory() {
  const [college, setCollege] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [faculty, setFaculty] = useState(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");

  useEffect(() => {
    client.get("/public/overview").then(({ data }) => {
      setCollege(data.college);
      setDepartments(data.departments);
    });
  }, []);

  function load() {
    setError(false);
    const params = {};
    if (query) params.q = query;
    if (department) params.department = department;
    client
      .get("/public/faculty", { params })
      .then(({ data }) => setFaculty(data.faculty))
      .catch(() => setError(true));
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, department]);

  // Two faculty records have no department recorded. Show a dash rather than
  // the internal "[VERIFY]" marker used in the data.
  const deptName = (id) => publicText(departments.find((d) => d.id === id)?.name || id);

  return (
    <div className="relative">
      <PublicNav collegeName={college?.name} search="" onSearch={() => {}} />

      <section className="pt-32 pb-10 px-4 sm:px-6" style={{ background: "var(--color-surface-sunken)" }}>
        <div className="max-w-7xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-3">Faculty</p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight" style={{ color: "var(--color-text-primary)" }}>
            Experienced educators across every subject
          </h1>
          <p className="text-sm mt-2" style={{ color: "var(--color-text-secondary)" }}>
            {faculty ? `${faculty.length} faculty member${faculty.length === 1 ? "" : "s"}` : "Loading…"}
          </p>

          <div className="flex flex-wrap gap-3 mt-6">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-text-muted)" }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search faculty by name…"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-subtle)", color: "var(--color-text-primary)" }}
              />
            </div>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-subtle)", color: "var(--color-text-primary)" }}
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 py-14" style={{ background: "var(--color-surface-base)" }}>
        <div className="max-w-7xl mx-auto">
          {error ? (
            <ErrorState message="Couldn't load the faculty directory." onRetry={load} />
          ) : !faculty ? (
            <Loader label="Loading faculty…" />
          ) : faculty.length === 0 ? (
            <div className="flex flex-col items-center text-center py-16" style={{ color: "var(--color-text-muted)" }}>
              <SearchX size={28} className="mb-3" />
              <p className="text-sm">No faculty match your search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
              {faculty.map((f, i) => (
                <GlassFacultyCard key={f.id} faculty={f} deptName={deptName} delay={(i % 8) * 0.04} />
              ))}
            </div>
          )}
        </div>
      </section>

      <PublicFooter college={college || {}} />
    </div>
  );
}
