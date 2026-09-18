import { useEffect, useId, useMemo } from "react";
import { subjectsFor } from "../lib/academic";

/* =========================================================================
   AcademicFilters — the cascading academic pickers shared by Attendance and
   Internal Marks:

     Academic Year → Course (PUC / Degree) → Year / Class → Stream (PUC only)
       → Combination / Program → Section → Subject

   Every option comes from the database (GET /academic-config/scope). For a
   faculty member the choices are narrowed to their teaching assignments, so
   an unrelated class or subject is never offered. Changing an earlier choice
   clears the later ones that no longer fit.

   Native <select> elements are used deliberately: the browser draws their
   option list above all page content, on mobile as a full picker, so they
   cannot be clipped by cards, tables or modals.
   ========================================================================= */

function Select({ label, value, onChange, children, disabled, hint }) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="input">
        {children}
      </select>
      {hint && <p className="text-[11px] mt-1" style={{ color: "var(--color-text-muted)" }}>{hint}</p>}
    </div>
  );
}

/**
 * props:
 *   scope, value, onChange
 *   show: which pickers to render (default: all)
 *   mode: "teach" (faculty see assigned classes/subjects),
 *         "classTeacher" (faculty see classes they are class teacher of),
 *         "any" (no narrowing — reports for college-wide roles)
 */
export default function AcademicFilters({
  scope,
  value,
  onChange,
  show = ["academicYearId", "levelId", "classId", "streamId", "courseId", "sectionId", "subjectId"],
  mode = "teach",
  columns = "sm:grid-cols-2 lg:grid-cols-4",
  allowAllSections = true,
}) {
  const v = value;
  const set = (patch) => onChange({ ...v, ...patch });

  const restrictedRows = useMemo(() => {
    if (!scope) return null;
    if (mode === "classTeacher" && scope.role === "Faculty") return scope.classTeacherOf;
    if (mode === "teach") return scope.teachable;
    return null;
  }, [scope, mode]);

  const classes = useMemo(() => {
    if (!scope) return [];
    let list = scope.classes;
    if (restrictedRows) list = list.filter((c) => restrictedRows.some((r) => r.classId === c.id));
    return list;
  }, [scope, restrictedRows]);

  const levels = useMemo(
    () => (scope ? scope.levels.filter((l) => classes.some((c) => c.levelId === l.id)) : []),
    [scope, classes]
  );
  const level = scope?.levels.find((l) => l.id === v.levelId);
  const levelClasses = classes.filter((c) => !v.levelId || c.levelId === v.levelId);
  const streams = scope && level?.hasStreams ? scope.streams.filter((s) => s.levelId === level.id) : [];
  const programs = scope
    ? scope.courses.filter((c) => c.levelId === v.levelId && (!level?.hasStreams || !v.streamId || c.stream === v.streamId))
    : [];

  const sectionOptions = useMemo(() => {
    if (!scope || !v.classId) return { whole: false, sections: [] };
    if (!restrictedRows) return { whole: true, sections: scope.sections };
    const rows = restrictedRows.filter((r) => r.classId === v.classId && (!v.subjectId || !r.subjectId || r.subjectId === v.subjectId));
    const whole = rows.some((r) => !r.sectionId);
    return {
      whole,
      sections: whole ? scope.sections : scope.sections.filter((s) => rows.some((r) => r.sectionId === s.id)),
    };
  }, [scope, restrictedRows, v.classId, v.subjectId]);

  const subjects = useMemo(
    () =>
      subjectsFor(mode === "teach" ? scope : scope && { ...scope, teachable: null }, {
        levelId: v.levelId,
        streamId: v.streamId,
        classId: v.classId,
        courseId: v.courseId,
        sectionId: v.sectionId,
        department: v.department,
      }),
    [scope, mode, v.levelId, v.streamId, v.classId, v.courseId, v.sectionId, v.department]
  );

  // Keep choices valid when the options beneath them change, and pick the
  // only option automatically when there is exactly one.
  useEffect(() => {
    if (!scope) return;
    const patch = {};
    if (show.includes("academicYearId") && !v.academicYearId) {
      const cur = scope.academicYears.find((y) => y.isCurrent) || scope.academicYears[0];
      if (cur) patch.academicYearId = cur.id;
    }
    // A class chosen elsewhere (a link, a saved selection) brings its level.
    if (v.classId && !v.levelId) {
      const cls = scope.classes.find((c) => c.id === v.classId);
      if (cls) patch.levelId = cls.levelId;
    }
    if (show.includes("levelId") && !v.levelId && !patch.levelId && levels.length === 1) patch.levelId = levels[0].id;
    if (v.classId && !classes.some((c) => c.id === v.classId)) patch.classId = "";
    if (show.includes("classId") && !v.classId && (patch.levelId || v.levelId)) {
      const options = classes.filter((c) => c.levelId === (patch.levelId || v.levelId));
      if (options.length === 1) patch.classId = options[0].id;
    }
    if (!sectionOptions.whole && v.classId && !v.sectionId && sectionOptions.sections.length === 1) {
      patch.sectionId = sectionOptions.sections[0].id;
    }
    if (v.sectionId && v.classId && !sectionOptions.sections.some((s) => s.id === v.sectionId)) patch.sectionId = "";
    if (show.includes("subjectId") && v.subjectId && !subjects.some((s) => s.id === v.subjectId)) patch.subjectId = "";
    if (show.includes("subjectId") && !v.subjectId && subjects.length === 1) patch.subjectId = subjects[0].id;
    if (Object.keys(patch).length) onChange({ ...v, ...patch });
  }, [scope, levels, classes, sectionOptions, subjects]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!scope) return null;
  const has = (k) => show.includes(k);

  return (
    <div className={`grid grid-cols-1 ${columns} gap-3`}>
      {has("academicYearId") && (
        <Select label="Academic Year" value={v.academicYearId || ""} onChange={(x) => set({ academicYearId: x })}>
          {scope.academicYears.length === 0 && <option value="">No academic year configured</option>}
          {scope.academicYears.map((y) => (
            <option key={y.id} value={y.id}>{y.label}{y.isCurrent ? " (current)" : ""}</option>
          ))}
        </Select>
      )}
      {has("levelId") && (
        <Select
          label="Course"
          value={v.levelId || ""}
          onChange={(x) => set({ levelId: x, classId: "", streamId: "", courseId: "", sectionId: "", subjectId: "" })}
        >
          <option value="">Select course…</option>
          {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </Select>
      )}
      {has("classId") && (
        <Select
          label="Year / Class"
          value={v.classId || ""}
          disabled={!v.levelId && has("levelId")}
          onChange={(x) => set({ classId: x, sectionId: "", subjectId: "" })}
        >
          <option value="">{restrictedRows && levelClasses.length === 0 ? "No classes assigned" : "Select class…"}</option>
          {levelClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      )}
      {has("streamId") && level?.hasStreams && (
        <Select label="Stream" value={v.streamId || ""} onChange={(x) => set({ streamId: x, courseId: "", subjectId: "" })}>
          <option value="">All streams</option>
          {streams.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      )}
      {has("courseId") && v.levelId && (
        <Select
          label={level?.hasStreams ? "Combination" : "Program"}
          value={v.courseId || ""}
          onChange={(x) => set({ courseId: x, subjectId: "" })}
          hint={programs.length === 0 ? "None are active. Enable one under Academic Setup." : undefined}
        >
          <option value="">{level?.hasStreams ? "All combinations" : "All programs"}</option>
          {programs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      )}
      {has("sectionId") && (
        <Select label="Section" value={v.sectionId || ""} disabled={!v.classId} onChange={(x) => set({ sectionId: x, subjectId: has("subjectId") ? "" : v.subjectId })}>
          {(sectionOptions.whole && allowAllSections) || !v.classId ? <option value="">Whole class</option> : <option value="">Select section…</option>}
          {sectionOptions.sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      )}
      {has("department") && (
        <Select label="Department" value={v.department || ""} onChange={(x) => set({ department: x, subjectId: "" })}>
          <option value="">All departments</option>
          {scope.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
      )}
      {has("subjectId") && (
        <Select
          label="Subject"
          value={v.subjectId || ""}
          disabled={!v.classId}
          onChange={(x) => set({ subjectId: x })}
          hint={v.classId && subjects.length === 0 ? (scope.teachable ? "You have no subject assigned for this class and section." : "No subjects are mapped to this class.") : undefined}
        >
          <option value="">Select subject…</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ""}</option>)}
        </Select>
      )}
    </div>
  );
}
