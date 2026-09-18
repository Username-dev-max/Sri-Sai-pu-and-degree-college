import { motion } from "framer-motion";
import { ArrowRight, GraduationCap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import usePrefersReducedMotion from "../../hooks/usePrefersReducedMotion";
import CampusImage from "../CampusImage";

export default function Hero({ departments = [], college = {} }) {
  const navigate = useNavigate();
  const reduced = usePrefersReducedMotion();
  const deptList = departments.map((d) => d.name).join(", ");
  // The tagline is a motto, not body copy — it gets its own line under the
  // name rather than standing in for the descriptive paragraph.
  const subcopy =
    college.description ||
    `Pre-University and Degree programs${deptList ? ` across ${deptList}` : ""}. Located in Bethamangala, K.G.F. Taluk, Kolar, Karnataka.`;

  function goAnchor(sel) {
    document.querySelector(sel)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="px-4 sm:px-6 pt-28 sm:pt-32 pb-16 sm:pb-20" style={{ background: "var(--color-surface-base)" }}>
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase mb-6"
            style={{ background: "var(--color-gold-soft)", color: "#8a651d" }}
          >
            <GraduationCap size={13} />
            Pre-University &amp; Degree College
          </div>

          <h1
            className="font-display text-4xl sm:text-5xl font-semibold leading-[1.1] tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            {college.name || "Sri Sai PU and Degree College"}
          </h1>

          {college.tagline && (
            <p className="mt-3 font-display text-lg sm:text-xl italic" style={{ color: "var(--color-gold)" }}>
              {college.tagline}
            </p>
          )}

          <p className="mt-5 text-base sm:text-lg leading-relaxed max-w-xl" style={{ color: "var(--color-text-secondary)" }}>
            {subcopy}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              onClick={() => goAnchor("#programs")}
              className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-600/20 transition-colors"
            >
              Explore Academics
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={() => goAnchor("#contact")}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold transition-colors"
              style={{ border: "1px solid var(--color-border-default)", color: "var(--color-text-primary)" }}
            >
              Contact the College
            </button>
            <button
              onClick={() => navigate("/login")}
              className="inline-flex items-center gap-2 px-5 py-3.5 text-sm font-semibold transition-colors"
              style={{ color: "var(--color-brand-600)" }}
            >
              Student / Faculty Portal →
            </button>
          </div>

          <div className="flex flex-wrap gap-x-10 gap-y-6 mt-12 pt-8" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
            <div>
              <div className="font-display text-2xl font-semibold" style={{ color: "var(--color-text-primary)" }}>1st</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>Place, K.G.F. Taluk<br />II PUC, April 2022</div>
            </div>
            <div>
              <div className="font-display text-2xl font-semibold" style={{ color: "var(--color-text-primary)" }}>PU + UG</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>Pre-University and<br />Degree programs</div>
            </div>
            {/* The founding year is only shown once an administrator has
                entered it under College Profile. An empty stat reading
                "Est. [—]" made a finished page look unfinished, and the
                year must not be guessed. */}
            {college.establishedYear ? (
              <div>
                <div className="font-display text-2xl font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  {`Est. ${college.establishedYear}`}
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                  Year established
                </div>
              </div>
            ) : null}
          </div>
        </motion.div>

        <motion.div
          initial={reduced ? false : { opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <CampusImage
            src="/campus/building-1.jpg"
            alt="Sri Sai PU and Degree College campus building"
            label="[MAIN BUILDING PHOTO]"
            className="h-[320px] sm:h-[420px] lg:h-[460px] w-full"
            kenBurns
            glow
          />
        </motion.div>
      </div>
    </section>
  );
}
