import { useEffect, useState } from "react";
import { UserRound, BookOpen, FileText, Download, ShieldCheck } from "lucide-react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b" style={{ borderColor: "var(--color-border-subtle)" }}>
      <dt className="text-sm shrink-0" style={{ color: "var(--color-text-muted)" }}>{label}</dt>
      <dd className="text-sm font-medium text-right break-words" style={{ color: "var(--color-text-primary)" }}>
        {value || "—"}
      </dd>
    </div>
  );
}

function Card({ title, icon: Icon, children }) {
  return (
    <div className="glass glow-card rounded-2xl p-5 shadow-sm">
      <h3 className="flex items-center gap-2 text-sm font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
        <Icon size={15} className="text-blue-600" /> {title}
      </h3>
      {children}
    </div>
  );
}

/**
 * The signed-in student's own profile. Every request here is scoped by the
 * server to req.user.linkedId — this page cannot be pointed at another
 * student, because it never sends a student id it chose itself.
 */
export default function StudentProfile() {
  const { user } = useAuth();
  const [student, setStudent] = useState(null);
  const [config, setConfig] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState(false);

  function load() {
    setError(false);
    Promise.all([
      client.get(`/students/${user.linkedId}`).then(({ data }) => setStudent(data.student)),
      client.get("/academic-config").then(({ data }) => setConfig(data)),
      client
        .get(`/documents?ownerType=student&ownerId=${user.linkedId}`)
        .then(({ data }) => setDocuments(data.documents || []))
        .catch(() => setDocuments([])),
    ]).catch(() => setError(true));
  }
  useEffect(load, [user.linkedId]);

  async function download(doc) {
    try {
      const res = await client.get(`/documents/${doc.id}/file`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // The server refuses anything not belonging to this student.
    }
  }

  if (error) return <ErrorState full message="Couldn't load your profile." onRetry={load} />;
  if (!student || !config) return <Loader full label="Loading your profile…" />;

  const combination = config.combinations.find((c) => c.id === student.course);
  const name = (id, list) => list.find((x) => x.id === id)?.name || "—";

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="glass glow-soft rounded-2xl p-5 flex items-center gap-4 flex-wrap">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
          style={{ background: "var(--color-surface-sunken)", border: "1px solid var(--color-border-default)" }}
        >
          {student.photoUrl ? (
            <img src={student.photoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <UserRound size={28} style={{ color: "var(--color-text-muted)" }} />
          )}
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>{student.name}</h2>
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            {student.admissionNumber || student.id}
            {combination && ` · ${combination.name}`}
          </p>
        </div>
        <div className="ml-auto">
          <StatusBadge tone={student.status === "Active" ? "success" : "neutral"}>{student.status}</StatusBadge>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <Card title="Personal Information" icon={UserRound}>
          <dl>
            <Row label="Date of Birth" value={student.dob} />
            <Row label="Gender" value={student.gender} />
            <Row label="Blood Group" value={student.bloodGroup} />
            <Row label="Mobile" value={student.phone} />
            <Row label="Email" value={student.email} />
            <Row label="Address" value={student.address} />
            <Row label="Guardian" value={student.guardian} />
            <Row label="Guardian Mobile" value={student.guardianPhone} />
          </dl>
        </Card>

        <Card title="Academic Information" icon={BookOpen}>
          <dl>
            <Row label="Admission Number" value={student.admissionNumber} />
            <Row label="Academic Year" value={name(student.academicYear, config.academicYears) !== "—" ? config.academicYears.find((y) => y.id === student.academicYear)?.label : "—"} />
            <Row label="Course" value={name(student.levelId, config.levels)} />
            <Row label="Stream" value={name(student.stream, config.streams)} />
            <Row label="Combination" value={combination?.name} />
            <Row label="Class" value={name(student.classId, config.classes)} />
            <Row label="Section" value={name(student.section, config.sections)} />
            <Row label="Roll Number" value={student.rollNumber} />
          </dl>
          {combination && combination.subjects.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>My Subjects</div>
              <div className="flex flex-wrap gap-1.5">
                {combination.subjects.map((s) => (
                  <span key={s.id} className="text-[11px] px-2 py-1 rounded-lg bg-blue-600/10 text-blue-700">{s.name}</span>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card title="My Documents" icon={FileText}>
        {documents.length === 0 ? (
          <EmptyState icon={FileText} title="No documents" description="Documents filed by the college office will appear here." />
        ) : (
          <div className="space-y-2">
            {documents.map((d) => (
              <div key={d.id} className="flex items-center gap-3 rounded-xl p-3" style={{ background: "var(--color-surface-sunken)" }}>
                <FileText size={15} className="text-blue-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate" style={{ color: "var(--color-text-primary)" }}>{d.type}</div>
                  <div className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>{d.name}</div>
                </div>
                <button
                  onClick={() => download(d)}
                  aria-label={`Download ${d.type}`}
                  className="p-2 rounded-lg hover:bg-blue-500/10 text-blue-600 shrink-0"
                >
                  <Download size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="flex items-start gap-1.5 text-[11px] mt-3" style={{ color: "var(--color-text-muted)" }}>
          <ShieldCheck size={13} className="shrink-0 mt-px" />
          Your documents are stored privately and are only accessible to you, your linked parent and college administrators.
        </p>
      </Card>
    </div>
  );
}
