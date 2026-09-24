import { useNavigate } from "react-router-dom";
import { MapPin, Mail, Phone, ArrowUpRight, LogIn, Link2 } from "lucide-react";
import CollegeLogo from "../CollegeLogo";

/* A footer carries the things a visitor looks for last and trusts most:
   where the college is, how to reach it, and where everything else lives.
   Laid out as columns on a wide screen and a single stack on a phone.

   Every link is at least 44px tall on touch, which is the smallest target
   that can be tapped reliably. The previous footer used 16px text buttons,
   which measured 16px tall and were easy to miss. */

const QUICK = [
  { href: "#intro", label: "About the College" },
  { href: "/departments", label: "Departments" },
  { href: "/faculty-directory", label: "Faculty" },
  { href: "#programs", label: "Programs" },
];

const EXPLORE = [
  { href: "/achievements", label: "Achievements" },
  { href: "/sports", label: "Sports" },
  { href: "/gallery", label: "Gallery" },
  { href: "/teams", label: "Developed By" },
];

// lucide-react v1 no longer ships brand marks, so one neutral link icon is
// used for every social profile rather than shipping look-alike artwork.

export default function PublicFooter({ college = {} }) {
  const navigate = useNavigate();

  function go(href) {
    if (href.startsWith("#")) document.querySelector(href)?.scrollIntoView({ behavior: "smooth", block: "start" });
    else navigate(href);
  }

  const social = Object.entries(college.social || {}).filter(([, url]) => url);
  const name = college.name || "Sri Sai PU and Degree College";

  const FooterLink = ({ href, label }) => (
    <li>
      <button
        onClick={() => go(href)}
        className="group flex items-center gap-1.5 py-2.5 min-h-[44px] text-sm w-full text-left transition-colors hover:text-blue-600"
        style={{ color: "var(--color-text-secondary)" }}
      >
        <span>{label}</span>
        <ArrowUpRight
          size={13}
          className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 shrink-0"
        />
      </button>
    </li>
  );

  const Heading = ({ children }) => (
    <h3
      className="text-[11px] font-semibold uppercase tracking-widest mb-1"
      style={{ color: "var(--color-text-muted)" }}
    >
      {children}
    </h3>
  );

  return (
    <footer className="border-t" style={{ background: "var(--color-surface-sunken)", borderColor: "var(--color-border-subtle)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-14">
        <div className="grid gap-10 sm:gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Identity */}
          <div className="lg:pr-6">
            <div className="flex items-center gap-2.5 mb-4">
              <CollegeLogo size={40} />
              <div className="min-w-0">
                <div className="font-display font-semibold text-sm leading-tight" style={{ color: "var(--color-text-primary)" }}>
                  {name}
                </div>
                {college.tagline ? (
                  <div className="text-[11px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>{college.tagline}</div>
                ) : null}
              </div>
            </div>
            {college.description ? (
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                {college.description}
              </p>
            ) : null}

            {social.length > 0 && (
              <div className="flex items-center gap-2 mt-5">
                {social.map(([key, url]) => {
                  return (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={key}
                      className="w-11 h-11 rounded-xl flex items-center justify-center transition-all hover:-translate-y-0.5 hover:text-blue-600"
                      style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-subtle)", color: "var(--color-text-muted)" }}
                    >
                      <Link2 size={16} />
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick links */}
          <div>
            <Heading>The College</Heading>
            <ul>{QUICK.map((l) => <FooterLink key={l.href} {...l} />)}</ul>
          </div>

          {/* Explore */}
          <div>
            <Heading>Explore</Heading>
            <ul>{EXPLORE.map((l) => <FooterLink key={l.href} {...l} />)}</ul>
          </div>

          {/* Contact */}
          <div>
            <Heading>Reach Us</Heading>
            <ul className="space-y-1">
              {college.address ? (
                <li className="flex gap-2.5 py-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
                  <MapPin size={15} className="shrink-0 mt-0.5 text-blue-600" />
                  <span className="leading-relaxed">{college.address}</span>
                </li>
              ) : null}
              {college.phone ? (
                <li>
                  <a href={`tel:${college.phone}`} className="flex items-center gap-2.5 py-2.5 min-h-[44px] text-sm transition-colors hover:text-blue-600" style={{ color: "var(--color-text-secondary)" }}>
                    <Phone size={15} className="shrink-0 text-blue-600" />
                    {college.phone}
                  </a>
                </li>
              ) : null}
              {college.email ? (
                <li>
                  <a href={`mailto:${college.email}`} className="flex items-center gap-2.5 py-2.5 min-h-[44px] text-sm break-all transition-colors hover:text-blue-600" style={{ color: "var(--color-text-secondary)" }}>
                    <Mail size={15} className="shrink-0 text-blue-600" />
                    {college.email}
                  </a>
                </li>
              ) : null}
              <li>
                <button
                  onClick={() => navigate("/login")}
                  className="mt-2 inline-flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-xl text-sm font-semibold text-white transition-colors w-full sm:w-auto hover:brightness-110"
                  /* A fixed strong blue rather than bg-blue-600: the dark theme
                     remaps that token to a light tint meant for TEXT, and white
                     on it falls to 3.8:1. This reads the same in both themes. */
                  style={{ background: "#1d4ed8" }}
                >
                  <LogIn size={15} />
                  Student / Staff Portal
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t" style={{ borderColor: "var(--color-border-subtle)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-center sm:text-left" style={{ color: "var(--color-text-muted)" }}>
            © {new Date().getFullYear()} {name}. All rights reserved.
          </p>
          <button
            onClick={() => go("/teams")}
            className="text-xs min-h-[44px] px-2 transition-colors hover:text-blue-600"
            style={{ color: "var(--color-text-muted)" }}
          >
            Developed by the college project teams
          </button>
        </div>
      </div>
    </footer>
  );
}
