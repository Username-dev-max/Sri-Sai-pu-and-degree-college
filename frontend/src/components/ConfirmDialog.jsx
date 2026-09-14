import Modal from "./Modal";
import { AlertTriangle } from "lucide-react";

export default function ConfirmDialog({ open, onClose, onConfirm, title = "Are you sure?", message, danger = true, loading = false }) {
  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-sm">
      <div className="flex flex-col items-center text-center">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${danger ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>
          <AlertTriangle size={24} />
        </div>
        <p className="text-sm text-slate-600 mb-5">{message}</p>
        <div className="flex gap-2 w-full">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-60 ${danger ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}
          >
            {loading ? "Please wait…" : "Confirm"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
