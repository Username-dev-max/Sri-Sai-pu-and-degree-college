import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Upload, ImageOff } from "lucide-react";
import client from "../api/client";
import { useToast } from "../context/ToastContext";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import Button from "../components/Button";

const CATEGORIES = [
  "Campus", "College Building", "Classrooms", "Computer Laboratory", "Science Laboratory",
  "Library", "Sports", "Faculty", "Students", "Events", "Cultural Activities", "Achievements",
];

export default function GalleryAdmin() {
  const { push } = useToast();
  const fileRef = useRef(null);
  const [items, setItems] = useState(null);
  const [error, setError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  function load() {
    setError(false);
    client
      .get("/gallery")
      .then(({ data }) => setItems(data.galleryItems))
      .catch(() => setError(true));
  }
  useEffect(load, []);

  function openAdd() {
    setCategory(CATEGORIES[0]);
    setCaption("");
    setFile(null);
    setPreview(null);
    setModalOpen(true);
  }

  function pickFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function submit(e) {
    e.preventDefault();
    if (!file) return push("Choose an image to upload.", "error");
    setSaving(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data: uploadData } = await client.post("/uploads", form);
      await client.post("/gallery", { category, caption, imageUrl: uploadData.url });
      push("Photo added to gallery.", "success");
      setModalOpen(false);
      load();
    } catch (err) {
      push(err.response?.data?.error || "Could not upload the photo.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await client.delete(`/gallery/${deleteTarget.id}`);
      push("Photo removed.", "success");
      setDeleteTarget(null);
      load();
    } catch (err) {
      push(err.response?.data?.error || "Could not delete.", "error");
    } finally {
      setDeleting(false);
    }
  }

  if (error) return <ErrorState full message="Couldn't load the gallery." onRetry={load} />;
  if (!items) return <Loader full label="Loading gallery…" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          Photos uploaded here appear on the public Gallery page and Home preview.
        </p>
        <Button icon={Plus} onClick={openAdd}>Add Photo</Button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={ImageOff} title="No photos yet" description="Upload the first campus photo to get started." />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          {items.map((g) => (
            <div key={g.id} className="glass glow-card glow-media rounded-xl overflow-hidden group relative">
              <img src={g.imageUrl} alt={g.caption || g.category} className="w-full aspect-square object-cover" />
              <div className="p-2">
                <div className="text-xs font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>{g.category}</div>
                {g.caption && <div className="text-[11px] truncate" style={{ color: "var(--color-text-muted)" }}>{g.caption}</div>}
              </div>
              <button
                onClick={() => setDeleteTarget(g)}
                title="Delete"
                aria-label={`Delete photo ${g.id}`}
                className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Photo">
        <form onSubmit={submit} className="space-y-4">
          <div
            onClick={() => fileRef.current?.click()}
            className="rounded-xl border border-dashed cursor-pointer flex flex-col items-center justify-center gap-2 py-8"
            style={{ borderColor: "var(--color-border-default)", color: "var(--color-text-muted)" }}
          >
            {preview ? (
              <img src={preview} alt="Preview" className="max-h-40 rounded-lg" />
            ) : (
              <>
                <Upload size={22} />
                <span className="text-xs font-medium">Click to choose an image</span>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={pickFile} className="hidden" />

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Category *</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Caption</label>
            <input value={caption} onChange={(e) => setCaption(e.target.value)} className="input" placeholder="Optional" />
          </div>

          <Button type="submit" loading={saving} className="w-full">
            {saving ? "Uploading…" : "Upload Photo"}
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        message="This will permanently remove this photo from the gallery."
      />
    </div>
  );
}
