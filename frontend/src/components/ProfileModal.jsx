import { useState } from "react";
import { KeyRound, UserCircle2 } from "lucide-react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Modal from "./Modal";
import Button from "./Button";

export default function ProfileModal({ open, onClose }) {
  const { user, updateUser } = useAuth();
  const { push } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirm("");
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

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="My Profile">
      <div className="flex items-center gap-3 pb-4 mb-4 border-b" style={{ borderColor: "var(--color-border-subtle)" }}>
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white flex items-center justify-center font-bold">
          {user?.name?.[0] || <UserCircle2 size={20} />}
        </div>
        <div>
          <div className="font-semibold" style={{ color: "var(--color-text-primary)" }}>{user?.name}</div>
          <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{user?.role} · {user?.username}</div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-sm font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
        <KeyRound size={15} /> Change Password
      </div>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>Current password</label>
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>New password</label>
          <input
            type="password"
            required
            minLength={6}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>Confirm new password</label>
          <input
            type="password"
            required
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="input"
          />
        </div>
        <Button type="submit" loading={saving} className="w-full mt-1">
          Update Password
        </Button>
      </form>
    </Modal>
  );
}
