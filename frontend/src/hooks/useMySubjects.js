import { useEffect, useState } from "react";
import client from "../api/client";

/**
 * The subjects the signed-in user may actually teach.
 *
 * Backed by /api/faculty-assignments/my-subjects rather than filtering the
 * full subject list client-side — the server is the authority on scope, and
 * it rejects a write to an unassigned subject regardless of what this returns.
 *
 * `unrestricted` is true for Admin (and for Attendance Staff via the
 * `allSubjects` caller), meaning the whole subject list applies.
 */
export default function useMySubjects({ allSubjects = false } = {}) {
  const [state, setState] = useState({ subjects: null, classes: [], unrestricted: false, error: false });

  useEffect(() => {
    let cancelled = false;

    // Attendance Staff are college-wide, so they read the plain subject list;
    // the assignments endpoint is only meaningful for Faculty/Admin.
    const request = allSubjects
      ? client.get("/subjects").then(({ data }) => ({ subjects: data.subjects || [], classes: [], unrestricted: true }))
      : client.get("/faculty-assignments/my-subjects").then(({ data }) => ({
          subjects: data.subjects || [],
          classes: data.classes || [],
          unrestricted: !!data.unrestricted,
        }));

    request
      .then((r) => !cancelled && setState({ ...r, error: false }))
      .catch(() => !cancelled && setState({ subjects: [], classes: [], unrestricted: false, error: true }));

    return () => {
      cancelled = true;
    };
  }, [allSubjects]);

  return state;
}
