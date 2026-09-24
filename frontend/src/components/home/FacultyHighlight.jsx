import { useNavigate } from "react-router-dom";
import GlassFacultyCard from "../GlassFacultyCard";
import { publicText } from "../../lib/display";

export default function FacultyHighlight({ faculty = [], departments = [] }) {
  const navigate = useNavigate();
  const deptName = (id) => publicText(departments.find((d) => d.id === id)?.name || id);

  if (!faculty.length) return null;
  const preview = faculty.slice(0, 4);

  return (
    <section id="faculty" className="relative overflow-hidden py-20 sm:py-28 px-4 sm:px-6" style={{ background: "var(--color-surface-sunken)" }}>
      <div className="absolute top-[-100px] left-[-60px] w-96 h-96 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(37,99,235,0.10), transparent 70%)" }} />
      <div className="absolute bottom-[-120px] right-[-60px] w-[28rem] h-[28rem] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(201,154,59,0.14), transparent 70%)" }} />
      <div className="max-w-7xl mx-auto relative">
        <div className="flex items-end justify-between mb-14 flex-wrap gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-3">Faculty</p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight" style={{ color: "var(--color-text-primary)" }}>
              Experienced educators across every subject
            </h2>
          </div>
          <button onClick={() => navigate("/faculty-directory")} className="group inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700 min-h-[44px] px-1 transition-colors">
            View all {faculty.length} faculty →
          </button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {preview.map((f, i) => (
            <GlassFacultyCard key={f.id} faculty={f} deptName={deptName} delay={i * 0.07} />
          ))}
        </div>
      </div>
    </section>
  );
}
