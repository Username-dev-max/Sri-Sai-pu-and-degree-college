import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import client from "../api/client";
import { useToast } from "../context/ToastContext";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";
import Button from "../components/Button";

const SOCIAL_KEYS = ["facebook", "twitter", "instagram", "linkedin"];

function Field({ label, ...props }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-secondary)" }}>{label}</span>
      <input className="input" {...props} />
    </label>
  );
}

export default function CollegeProfile() {
  const { push } = useToast();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  function load() {
    setError(false);
    client
      .get("/college-profile")
      .then(({ data }) => setProfile(data.profile))
      .catch(() => setError(true));
  }

  useEffect(() => {
    load();
  }, []);

  function update(field, value) {
    setProfile((p) => ({ ...p, [field]: value }));
  }

  function updateSocial(key, value) {
    setProfile((p) => ({ ...p, social: { ...p.social, [key]: value } }));
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await client.put("/college-profile", profile);
      setProfile(data.profile);
      push("College profile saved. The homepage now reflects these details.", "success");
    } catch (err) {
      push(err.response?.data?.error || "Could not save the profile.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (error) return <ErrorState full message="Couldn't load the college profile." onRetry={load} />;
  if (!profile) return <Loader full label="Loading profile…" />;

  return (
    <form onSubmit={save} className="space-y-6 max-w-4xl">
      <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
        These details power the public homepage's About, Contact and footer sections. Fields left blank are simply
        omitted there — nothing is invented on your behalf.
      </p>

      <section className="glass rounded-2xl p-5 sm:p-6 space-y-4">
        <h3 className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>Identity</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="College name" value={profile.name} onChange={(e) => update("name", e.target.value)} required />
          <Field label="Short name" value={profile.shortName} onChange={(e) => update("shortName", e.target.value)} placeholder="e.g. SJC" />
          <Field label="Tagline" value={profile.tagline} onChange={(e) => update("tagline", e.target.value)} placeholder="A short line shown in the hero" />
          <Field label="Established year" value={profile.establishedYear} onChange={(e) => update("establishedYear", e.target.value)} placeholder="e.g. 1985" />
        </div>
        <label className="block">
          <span className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-secondary)" }}>Description</span>
          <textarea className="input resize-none" rows={3} value={profile.description} onChange={(e) => update("description", e.target.value)} placeholder="A paragraph introducing the college for the homepage About section" />
        </label>
      </section>

      <section className="glass rounded-2xl p-5 sm:p-6 space-y-4">
        <h3 className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>Leadership</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Principal / Director name" value={profile.principalName} onChange={(e) => update("principalName", e.target.value)} />
          <Field label="Title" value={profile.principalTitle} onChange={(e) => update("principalTitle", e.target.value)} placeholder="e.g. Principal" />
        </div>
      </section>

      <section className="glass rounded-2xl p-5 sm:p-6 space-y-4">
        <h3 className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>Contact</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Phone" value={profile.phone} onChange={(e) => update("phone", e.target.value)} />
          <Field label="Public email" type="email" value={profile.email} onChange={(e) => update("email", e.target.value)} />
          <Field label="Website" value={profile.website} onChange={(e) => update("website", e.target.value)} placeholder="https://" />
          <Field label="Address" value={profile.address} onChange={(e) => update("address", e.target.value)} />
        </div>
      </section>

      <section className="glass rounded-2xl p-5 sm:p-6 space-y-4">
        <h3 className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>Vision & Mission</h3>
        <label className="block">
          <span className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-secondary)" }}>Vision</span>
          <textarea className="input resize-none" rows={2} value={profile.vision} onChange={(e) => update("vision", e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-secondary)" }}>Mission</span>
          <textarea className="input resize-none" rows={2} value={profile.mission} onChange={(e) => update("mission", e.target.value)} />
        </label>
      </section>

      <section className="glass rounded-2xl p-5 sm:p-6 space-y-4">
        <h3 className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>Social links</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          {SOCIAL_KEYS.map((key) => (
            <Field
              key={key}
              label={key.charAt(0).toUpperCase() + key.slice(1)}
              value={profile.social?.[key] || ""}
              onChange={(e) => updateSocial(key, e.target.value)}
              placeholder="https://"
            />
          ))}
        </div>
      </section>

      <Button type="submit" loading={saving} icon={Save}>
        {saving ? "Saving…" : "Save Profile"}
      </Button>
    </form>
  );
}
