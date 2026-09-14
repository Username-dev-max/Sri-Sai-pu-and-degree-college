import { useEffect, useState } from "react";
import { ImageOff, Images } from "lucide-react";
import client from "../api/client";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";
import PublicNav from "../components/home/PublicNav";
import PublicFooter from "../components/home/PublicFooter";

const CATEGORIES = [
  "Campus", "College Building", "Classrooms", "Computer Laboratory", "Science Laboratory",
  "Library", "Sports", "Faculty", "Students", "Events", "Cultural Activities", "Achievements",
];

function Placeholder({ label }) {
  return (
    <div
      className="aspect-[4/3] rounded-xl flex flex-col items-center justify-center gap-2 text-center px-3"
      style={{ background: "var(--color-surface-sunken)", border: "1px dashed var(--color-border-default)", color: "var(--color-text-muted)" }}
    >
      <ImageOff size={20} />
      <span className="text-[11px] font-semibold">{label}</span>
    </div>
  );
}

export default function PublicGallery() {
  const [college, setCollege] = useState(null);
  const [gallery, setGallery] = useState(null);
  const [error, setError] = useState(false);

  function load() {
    setError(false);
    Promise.all([
      client.get("/public/overview").then(({ data }) => setCollege(data.college)),
      client.get("/public/gallery").then(({ data }) => setGallery(data.gallery)),
    ]).catch(() => setError(true));
  }

  useEffect(load, []);

  return (
    <div className="relative min-h-screen">
      <PublicNav collegeName={college?.name} search="" onSearch={() => {}} />

      <section className="pt-32 pb-10 px-4 sm:px-6" style={{ background: "var(--color-surface-sunken)" }}>
        <div className="max-w-7xl mx-auto">
          <Images size={26} className="mb-3 text-blue-600" />
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight" style={{ color: "var(--color-text-primary)" }}>
            Campus Gallery
          </h1>
          <p className="text-sm mt-2" style={{ color: "var(--color-text-secondary)" }}>
            Photographs will be added by the college administration.
          </p>
        </div>
      </section>

      <section className="px-4 sm:px-6 py-14" style={{ background: "var(--color-surface-base)" }}>
        <div className="max-w-7xl mx-auto">
          {error ? (
            <ErrorState message="Couldn't load the gallery." onRetry={load} />
          ) : !gallery ? (
            <Loader label="Loading gallery…" />
          ) : (
            CATEGORIES.map((cat) => {
              const items = gallery.filter((g) => g.category === cat);
              return (
                <div key={cat} className="mb-10">
                  <h2 className="font-semibold text-sm mb-3" style={{ color: "var(--color-text-primary)" }}>{cat}</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                    {items.length > 0
                      ? items.map((g) => (
                          <div key={g.id} className="glow-media glow-card aspect-[4/3] rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-border-subtle)" }}>
                            <img src={g.imageUrl} alt={g.caption || cat} className="w-full h-full object-cover" />
                          </div>
                        ))
                      : <Placeholder label={`[${cat.toUpperCase()} PHOTO]`} />}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <PublicFooter college={college || {}} />
    </div>
  );
}
