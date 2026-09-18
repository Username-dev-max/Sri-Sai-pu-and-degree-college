import { useEffect, useState } from "react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";

// The child a parent last viewed, kept in memory only and keyed by account,
// so switching pages keeps the same child but nothing outlives the session.
const lastChild = new Map();

/**
 * The students a Parent account is linked to, and which one is selected.
 * For a Student account it is always just their own record.
 * The server authorises every per-student request separately.
 */
export function useLinkedChildren() {
  const { user } = useAuth();
  const ids = user?.role === "Parent" ? (user.linkedIds?.length ? user.linkedIds : user.linkedId ? [user.linkedId] : []) : user?.linkedId ? [user.linkedId] : [];
  const key = ids.join(",");
  const [names, setNames] = useState({});
  const [activeId, setActiveIdState] = useState(() => {
    const remembered = user ? lastChild.get(user.id) : null;
    return remembered && ids.includes(remembered) ? remembered : ids[0] || null;
  });

  useEffect(() => {
    if (!ids.includes(activeId)) setActiveIdState(ids[0] || null);
    if (user?.role !== "Parent") return;
    let cancelled = false;
    Promise.all(
      ids.map((id) =>
        client
          .get(`/students/${id}`)
          .then(({ data }) => [id, data.student.name])
          .catch(() => [id, id])
      )
    ).then((pairs) => !cancelled && setNames(Object.fromEntries(pairs)));
    return () => {
      cancelled = true;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  function setActiveId(id) {
    if (user) lastChild.set(user.id, id);
    setActiveIdState(id);
  }

  return { ids, names, activeId, setActiveId, isParent: user?.role === "Parent" };
}

/** Pill switcher shown only when a parent is linked to more than one child. */
export default function ChildSwitcher({ linked }) {
  const { ids, names, activeId, setActiveId, isParent } = linked;
  if (!isParent || ids.length < 2) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap" role="tablist" aria-label="Select child">
      <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Viewing:</span>
      {ids.map((id) => (
        <button
          key={id}
          role="tab"
          aria-selected={id === activeId}
          onClick={() => setActiveId(id)}
          className="text-sm px-3.5 py-1.5 rounded-lg font-medium transition-colors"
          style={{
            background: id === activeId ? "var(--color-brand-600)" : "var(--color-surface-raised)",
            color: id === activeId ? "#fff" : "var(--color-text-secondary)",
            border: "1px solid var(--color-border-default)",
          }}
        >
          {names[id] || id}
        </button>
      ))}
    </div>
  );
}
