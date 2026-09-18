import { useCallback, useEffect, useState } from "react";
import client from "../api/client";

/**
 * The academic structure (years, levels, classes, streams, programs, sections,
 * subjects) plus what the signed-in staff member may work on.
 *
 * `teachable` is null for college-wide roles; for Faculty it lists the exact
 * class / section / subject assignments. The pickers use it to offer only
 * valid choices — the server still re-checks every request.
 */
export default function useAcademicScope() {
  const [scope, setScope] = useState(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    client
      .get("/academic-config/scope")
      .then(({ data }) => setScope(data))
      .catch(() => setError(true));
  }, []);

  useEffect(load, [load]);

  return { scope, error, reload: load };
}
