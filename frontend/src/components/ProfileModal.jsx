import { useEffect, useRef, useState } from "react";
import { KeyRound, UserCircle2, Upload, Check } from "lucide-react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Modal from "./Modal";
import Button from "./Button";

/**
 * My Profile — a photograph and contact details, and a password change.
 *
 * Editing the name and photograph is offered to administrators only. The
 * account name is what every audit entry records, so letting a student
 * rename themselves would quietly make that history unreliable; the server
 * enforces the same rule rather than trusting this to hide the controls.
 */
export default function ProfileModal({ open, onClose }) {
  const { user, updateUser } = useAuth();
  const { push } = useToast();
  const photoRef = useRef(null);

  const canEdit = user?.role === "Admin";

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [photoUrl, setPhotoUrl] = useState(user?.photoUrl || "");
  const [uploading, setUploading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  // Re-seed the fields whenever the dialog opens, so a cancelled edit does
  // not linger the next time it is opened.
  useEffect(() => {
    if (!open) return;
    setName(user?.name || "");
    setEmail(user?.email || "");
    setPhotoUrl(user?.photoUrl || "");
  }, [open, user]);

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirm("");
  }

  async function pickPhoto(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", f);
      const { data } = await client.post("/uploads", body);
      setPhotoUrl(data.url);
    } catch (err) {
      push(err.response?.data?.error || "Could not upload the photograph.", "error");
    } finally {
      setUploading(false);
      if (photoRef.current) photoRef.current.value = "";
    }
  }

  async function saveProfile(e) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { data } = await client.put("/auth/me", { name, email, photoUrl });
      updateUser(data.user);
      push("Profile updated.", "success");
    } catch (err) {
      push(err.response?.data?.error || "Could not update your profile.", "error");
    } finally {
      setSavingProfile(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (newPassword.length < 6) return push("New password must be at least 6 characters.", "error");
    if (newPassword !== confirm) return push("Passwords do not match.", "error");
    setSaving(true);
    try {
      await client.post("/auth/change-password", { currentPassword, newPassword });
      updateUser({ mustReset: false });
      push("Password updated.", "success");
      reset();
      onClose();
    } catch (err) {
      push(err.response?.data?.error || "Could not update password.", "error");
    } finally {
      setSaving(false);
    }
  }

  const Avatar = ({ size = 64 }) =>
    photoUrl ? (
      <img src={photoUrl} alt="" className="rounded-full object-cover" style={{ width: size, height: size, border: "1px solid var(--color-border-subtle)" }} />
    ) : (
      <div
        className="rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white flex items-center justify-center font-bold"
        style={{ width: size, height: size, fontSize: size / 2.6 }}
      >
        {user?.name?.[0] || <UserCircle2 size={size / 2.4} />}
      </div>
    );

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="My Profile">
      <div className="flex items-center gap-4 pb-5 mb-5 border-b" style={{ borderColor: "var(--color-border-subtle)" }}>
        {canEdit ? (
          <button
            type="button"
            onClick={() => photoRef.current?.click()}
            className="relative rounded-full shrink-0 group"
            aria-label="Change your photograph"
            title="Change your photograph"
          >
            <Avatar size={64} />
            <span
              className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: "rgba(15,30,51,0.55)" }}
            >
              <Upload size={17} className="text-white" />
            </span>
          </button>
        ) : (
          <Avatar size={64} />
        )}
        <input ref={photoRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={pickPhoto} className="hidden" />

        <div className="min-w-0">
          <div className="font-semibold" style={{ color: "var(--color-text-primary)" }}>{user?.name}</div>
          <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{user?.role} · {user?.username}</div>
          {canEdit && (
            <div className="text-[11px] mt-1" style={{ color: "var(--color-text-muted)" }}>
              {uploading ? "Uploading…" : "Click the photograph to change it — square, 512x512, under 1 MB"}
            </div>
          )}
        </div>
      </div>

      {canEdit && (
        <form onSubmit={saveProfile} className="space-y-3 pb-5 mb-5 border-b" style={{ borderColor: "var(--color-border-subtle)" }}>
          <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            <UserCircle2 size={15} /> Details
          </div>
          <div>
            <label htmlFor="profile-name" className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>Display name</label>
            <input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} className="input" maxLength={80} />
          </div>
          <div>
            <label htmlFor="profile-email" className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>Email</label>
            <input id="profile-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
          </div>
          {photoUrl && (
            <button
              type="button"
              onClick={() => setPhotoUrl("")}
              className="text-[11px] hover:underline"
              style={{ color: "var(--color-danger)" }}
            >
              Remove photograph
            </button>
          )}
          <Button type="submit" icon={Check} loading={savingProfile} className="w-full">Save Details</Button>
        </form>
      )}

      <div className="flex items-center gap-1.5 text-sm font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
        <KeyRound size={15} /> Change Password
      </div>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="pw-current" className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>Current password</label>
          <input id="pw-current" type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="input" />
        </div>
        <div>
          <label htmlFor="pw-new" className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>New password</label>
          <input id="pw-new" type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input" />
        </div>
        <div>
          <label htmlFor="pw-confirm" className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>Confirm new password</label>
          <input id="pw-confirm" type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input" />
        </div>
        <Button type="submit" loading={saving} className="w-full mt-1">Update Password</Button>
      </form>
    </Modal>
  );
}
