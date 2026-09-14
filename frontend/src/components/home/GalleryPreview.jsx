import { useNavigate } from "react-router-dom";
import { ImageOff } from "lucide-react";

const PLACEHOLDER_LABELS = ["[CAMPUS PHOTO]", "[FACULTY PHOTO]", "[SPORTS PHOTO]", "[EVENT PHOTO]"];

export default function GalleryPreview({ gallery = [] }) {
  const navigate = useNavigate();
  const slots = gallery.length > 0 ? gallery.slice(0, 4) : PLACEHOLDER_LABELS.map((label) => ({ placeholder: label }));

  return (
    <section id="gallery" className="py-20 sm:py-28 px-4 sm:px-6" style={{ background: "var(--color-surface-base)" }}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: "var(--color-text-primary)" }}>Campus Gallery</h2>
          <button onClick={() => navigate("/gallery")} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
            View full gallery →
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {slots.map((item, i) =>
            item.placeholder ? (
              <div
                key={i}
                className="aspect-[4/3] rounded-xl flex flex-col items-center justify-center gap-2 text-center px-2"
                style={{ background: "var(--color-surface-sunken)", border: "1px dashed var(--color-border-default)", color: "var(--color-text-muted)" }}
              >
                <ImageOff size={18} />
                <span className="text-[10px] font-semibold">{item.placeholder}</span>
              </div>
            ) : (
              <div key={item.id} className="glow-media glow-card aspect-[4/3] rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-border-subtle)" }}>
                <img src={item.imageUrl} alt={item.caption || item.category} className="w-full h-full object-cover" />
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
}
