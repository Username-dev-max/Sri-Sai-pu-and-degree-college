import { useEffect, useState } from "react";
import { Trash2, Inbox, Mail, Phone } from "lucide-react";
import client from "../api/client";
import { useData } from "../context/DataContext";
import { useToast } from "../context/ToastContext";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import ConfirmDialog from "../components/ConfirmDialog";
import { Table, TableHead, TableTh, TableBody, TableRow, TableTd } from "../components/Table";

export default function AdmissionInquiries() {
  const { courseName } = useData();
  const { push } = useToast();
  const [inquiries, setInquiries] = useState(null);
  const [error, setError] = useState(false);
  const [target, setTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  function load() {
    setError(false);
    client
      .get("/admissions-inquiries")
      .then(({ data }) => setInquiries(data.admissionInquiries))
      .catch(() => setError(true));
  }

  useEffect(() => {
    load();
  }, []);

  async function confirmDelete() {
    setDeleting(true);
    try {
      await client.delete(`/admissions-inquiries/${target.id}`);
      setInquiries((list) => list.filter((i) => i.id !== target.id));
      push("Inquiry removed.", "success");
      setTarget(null);
    } catch (err) {
      push(err.response?.data?.error || "Could not remove this inquiry.", "error");
    } finally {
      setDeleting(false);
    }
  }

  if (error) return <ErrorState full message="Couldn't load admissions inquiries." onRetry={load} />;
  if (!inquiries) return <Loader full label="Loading inquiries…" />;

  return (
    <div className="space-y-6">
      <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
        Prospective-student inquiries submitted through the public homepage's admissions form.
      </p>

      <div className="glass rounded-2xl shadow-sm overflow-hidden">
        {inquiries.length === 0 ? (
          <EmptyState icon={Inbox} title="No inquiries yet" description="Submissions from the homepage admissions form will appear here." />
        ) : (
          <Table>
            <TableHead>
              <TableTh>Name</TableTh>
              <TableTh>Contact</TableTh>
              <TableTh>Program</TableTh>
              <TableTh>Message</TableTh>
              <TableTh>Submitted</TableTh>
              <TableTh align="right">Action</TableTh>
            </TableHead>
            <TableBody>
              {inquiries
                .slice()
                .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
                .map((inq) => (
                  <TableRow key={inq.id}>
                    <TableTd className="font-medium" style={{ color: "var(--color-text-primary)" }}>{inq.name}</TableTd>
                    <TableTd>
                      <div className="flex flex-col gap-0.5 text-xs">
                        <span className="flex items-center gap-1.5"><Mail size={12} /> {inq.email}</span>
                        <span className="flex items-center gap-1.5"><Phone size={12} /> {inq.phone}</span>
                      </div>
                    </TableTd>
                    <TableTd>{courseName(inq.program)}</TableTd>
                    <TableTd className="max-w-[220px] truncate" title={inq.message}>{inq.message || "—"}</TableTd>
                    <TableTd>{new Date(inq.submittedAt).toLocaleDateString()}</TableTd>
                    <TableTd align="right">
                      <button
                        onClick={() => setTarget(inq)}
                        title={`Delete inquiry from ${inq.name}`}
                        aria-label={`Delete inquiry from ${inq.name}`}
                        className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={15} />
                      </button>
                    </TableTd>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        )}
      </div>

      <ConfirmDialog
        open={!!target}
        onClose={() => setTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Remove inquiry?"
        message={target ? `Delete the inquiry from ${target.name}? This cannot be undone.` : ""}
      />
    </div>
  );
}
