import { Mail, Phone, MapPin, Globe, MessageCircleQuestion } from "lucide-react";

/**
 * Shows real contact details from the admin-editable college profile
 * (see pages/CollegeProfile.jsx) when present. Nothing here is invented —
 * fields the Admin hasn't filled in are simply omitted, and the section
 * always falls back to the one channel that's always real: the admissions
 * inquiry form above.
 */
export default function Contact({ college = {} }) {
  const rows = [
    college.phone && { icon: Phone, label: college.phone, href: `tel:${college.phone}` },
    college.email && { icon: Mail, label: college.email, href: `mailto:${college.email}` },
    college.website && { icon: Globe, label: college.website.replace(/^https?:\/\//, ""), href: college.website },
    college.address && { icon: MapPin, label: college.address, href: null },
  ].filter(Boolean);

  return (
    <section id="contact" className="py-16 sm:py-20 px-4 sm:px-6" style={{ background: "var(--color-surface-sunken)" }}>
      <div className="max-w-2xl mx-auto text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-3">Get in Touch</p>
        <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight mb-4" style={{ color: "var(--color-text-primary)" }}>
          Questions before you apply?
        </h2>

        {rows.length > 0 && (
          <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-4 sm:gap-8 mb-6">
            {rows.map((r, i) =>
              r.href ? (
                <a key={i} href={r.href} className="flex items-center gap-2 text-sm font-medium min-h-[44px] px-2 rounded-lg hover:text-blue-600 transition-colors" style={{ color: "var(--color-text-secondary)" }}>
                  <r.icon size={15} className="text-blue-600" /> {r.label}
                </a>
              ) : (
                <span key={i} className="flex items-center gap-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
                  <r.icon size={15} className="text-blue-600" /> {r.label}
                </span>
              )
            )}
          </div>
        )}

        <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--color-text-secondary)" }}>
          Or use the admissions form above — our office reviews every inquiry and reaches out directly with
          eligibility, documents and next steps.
        </p>
        <button
          onClick={() => document.querySelector("#admissions")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-600/20 transition-colors"
        >
          <MessageCircleQuestion size={16} />
          Go to the admissions form
        </button>
        <p className="text-xs mt-6" style={{ color: "var(--color-text-muted)" }}>
          {college.name || "Sri Sai PU and Degree College"}
        </p>
      </div>
    </section>
  );
}
