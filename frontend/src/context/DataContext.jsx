import { createContext, useContext, useCallback, useEffect, useState } from "react";
import client from "../api/client";
import { useAuth } from "./AuthContext";

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { user } = useAuth();
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
      setDepartments(d.data.departments);
      setCourses(c.data.courses);
      setSubjects(s.data.subjects);
      if (user && (user.role === "Admin" || user.role === "Faculty")) {
        const f = await client.get("/faculty");
        setFaculty(f.data.faculty);
      }
    } finally {
      setReady(true);
    }
  }, [user]);

  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

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
