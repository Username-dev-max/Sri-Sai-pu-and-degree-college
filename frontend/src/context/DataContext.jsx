import { createContext, useContext, useCallback, useEffect, useState } from "react";
import client from "../api/client";
import { useAuth } from "./AuthContext";

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { user, sessionId } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [d, c, s] = await Promise.all([
        client.get("/departments"),
        client.get("/courses"),
        client.get("/subjects"),
      ]);
      setDepartments(d.data.departments || []);
      setCourses(c.data.courses || []);
      setSubjects(s.data.subjects || []);
      if (user && (user.role === "Admin" || user.role === "Faculty")) {
        const f = await client.get("/faculty");
        setFaculty(f.data.faculty || []);
      } else {
        // Roles below Faculty have no business holding a staff directory in
        // memory, even one fetched for a previous account.
        setFaculty([]);
      }
    } catch {
      // A failed refresh must leave EMPTY caches, never the last account's.
      setDepartments([]); setCourses([]); setSubjects([]); setFaculty([]);
    } finally {
      setReady(true);
    }
  }, [user]);

  /**
   * Reset on every session change, then refetch for the new account.
   *
   * `sessionId` (not just `user`) is the trigger: it changes on login AND on
   * logout, so the caches are emptied the moment an account goes away rather
   * than lingering until the next successful fetch. Without this, signing out
   * of Admin and into Student left the Admin-fetched faculty directory
   * readable in memory.
   */
  useEffect(() => {
    setDepartments([]);
    setCourses([]);
    setSubjects([]);
    setFaculty([]);
    setReady(false);

    if (!user) {
      setReady(true);
      return;
    }
    let cancelled = false;
    // Guard against a slow response for the PREVIOUS account resolving after
    // a new one has signed in and overwriting the new caches.
    refresh().then(() => {
      if (cancelled) {
        setDepartments([]); setCourses([]); setSubjects([]); setFaculty([]);
      }
    });
    return () => { cancelled = true; };
  }, [user, sessionId, refresh]);

  const deptName = (id) => departments.find((d) => d.id === id)?.name || id;
  const courseName = (id) => courses.find((c) => c.id === id)?.name || id;
  const subjectName = (id) => subjects.find((s) => s.id === id)?.name || id;
  const facultyName = (id) => faculty.find((f) => f.id === id)?.name || id;

  return (
    <DataContext.Provider
      value={{ departments, courses, subjects, faculty, ready, refresh, deptName, courseName, subjectName, facultyName }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
