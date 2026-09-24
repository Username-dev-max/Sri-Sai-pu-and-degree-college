import { useState } from "react";
import { motion } from "framer-motion";
import { Send, CheckCircle2 } from "lucide-react";
import client from "../../api/client";
import usePrefersReducedMotion from "../../hooks/usePrefersReducedMotion";
import Button from "../Button";

const initial = { name: "", email: "", phone: "", program: "", message: "" };

export default function AdmissionsCTA({ courses = [] }) {
  const reduced = usePrefersReducedMotion();
  const [form, setForm] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await client.post("/public/admissions-inquiry", form);
      setDone(true);
      setForm(initial);
    } catch (err) {
      setError(err.response?.data?.error || "Could not submit your inquiry. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="admissions" className="py-20 sm:py-28 px-4 sm:px-6 bg-gradient-to-br from-[#0b1526] via-[#0f1e33] to-[#16294a] relative overflow-hidden">
      <div className="absolute -top-24 -right-24 w-80 h-80 bg-blue-600/15 rounded-full blur-3xl" />
      <div className="relative max-w-5xl mx-auto grid lg:grid-cols-2 gap-12 items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-300 mb-3">Admissions</p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-5">
            Start your application
          </h2>
          <p className="text-blue-100/70 text-base leading-relaxed mb-6">
            Tell us which program interests you and our admissions office will get in touch to walk you through
            eligibility, documents and next steps.
          </p>
          <p className="text-blue-100/50 text-sm">
            Already enrolled?{" "}
            <a href="/login" className="text-blue-300 hover:text-blue-200 font-medium underline underline-offset-4 decoration-blue-400/40 hover:decoration-blue-300 inline-flex items-center min-h-[44px] px-0.5 transition-colors">
              Sign in to your portal
            </a>{" "}
            instead.
          </p>
        </div>

        <motion.div
          initial={reduced ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-8%" }}
          transition={{ duration: 0.5 }}
          className="glass-dark rounded-2xl p-6 sm:p-7"
        >
          {done ? (
            <div className="flex flex-col items-center text-center py-8 text-white">
              <CheckCircle2 size={36} className="text-green-400 mb-3" />
              <h3 className="font-semibold text-base mb-1.5">Inquiry received</h3>
              <p className="text-sm text-blue-100/70 leading-relaxed">
                Thank you — our admissions office has your details and will reach out shortly.
              </p>
              <button
                onClick={() => setDone(false)}
                className="mt-5 text-sm text-blue-300 hover:text-blue-200 font-medium"
              >
                Submit another inquiry
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3.5">
              <div className="grid sm:grid-cols-2 gap-3.5">
                <input
                  required
                  placeholder="Full name"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                />
                <input
                  required
                  type="tel"
                  placeholder="Phone number"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                />
              </div>
              <input
                required
                type="email"
                placeholder="Email address"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
              />
              <select
                required
                value={form.program}
                onChange={(e) => update("program", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-400/50 [color-scheme:dark]"
              >
                <option value="" disabled className="text-slate-800">Select a program of interest</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id} className="text-slate-800">{c.name}</option>
                ))}
              </select>
              <textarea
                placeholder="Anything you'd like us to know? (optional)"
                value={form.message}
                onChange={(e) => update("message", e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400/50 resize-none"
              />
              {error && (
                <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</div>
              )}
              <Button type="submit" loading={submitting} icon={Send} className="w-full justify-center">
                {submitting ? "Submitting…" : "Submit Inquiry"}
              </Button>
            </form>
          )}
        </motion.div>
      </div>
    </section>
  );
}
