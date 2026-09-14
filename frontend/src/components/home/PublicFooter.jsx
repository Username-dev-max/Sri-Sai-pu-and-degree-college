import { useNavigate } from "react-router-dom";
import { GraduationCap, Link2 } from "lucide-react";
import CollegeLogo from "../CollegeLogo";

const LINKS = [
  { href: "#intro", label: "About" },
  { href: "/departments", label: "Departments" },
  { href: "/faculty-directory", label: "Faculty" },
  { href: "/sports", label: "Sports" },
  { href: "/achievements", label: "Achievements" },
  { href: "/gallery", label: "Gallery" },
  { href: "/teams", label: "Developed By" },
  { href: "#contact", label: "Contact" },
];

export default function PublicFooter({ college = {} }) {
  const navigate = useNavigate();
  function goAnchor(href) {
    if (href.startsWith("#")) {
      document.querySelector(href)?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      navigate(href);
    }
  }

  const socialLinks = Object.entries(college.social || {}).filter(([, url]) => url);

  return (
    <footer className="px-4 sm:px-6 py-10 border-t" style={{ background: "var(--color-surface-base)", borderColor: "var(--color-border-subtle)" }}>
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2.5">
          <CollegeLogo size={32} />
          <span className="font-display font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>
            {college.name || "Sri Sai PU and Degree College"}
          </span>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {LINKS.map((l) => (
            <button
              key={l.href}
              onClick={() => goAnchor(l.href)}
              className="text-xs font-medium hover:text-blue-600 transition-colors"
              style={{ color: "var(--color-text-muted)" }}
            >
              {l.label}
            </button>
          ))}
        </nav>

        {socialLinks.length > 0 && (
          <div className="flex items-center gap-3">
            {socialLinks.map(([key, url]) => (
              <a key={key} href={url} target="_blank" rel="noopener noreferrer" aria-label={key} className="hover:text-blue-600 transition-colors" style={{ color: "var(--color-text-muted)" }}>
                <Link2 size={16} />
              </a>
            ))}
          </div>
        )}

        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          © {new Date().getFullYear()} {college.name || "Sri Sai PU and Degree College"}
        </p>
      </div>
    </footer>
  );
}
