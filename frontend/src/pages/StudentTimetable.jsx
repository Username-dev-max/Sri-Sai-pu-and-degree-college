import { useEffect, useState } from "react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import TimetableGrid from "../components/TimetableGrid";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";

export default function StudentTimetable() {
  const { user } = useAuth();
  const { subjects } = useData();
  const [entries, setEntries] = useState(null);
  const [student, setStudent] = useState(null);
  const [error, setError] = useState(false);

  function loadStudent() {
    setError(false);
    client.get(`/students/${user.linkedId}`).then(({ data }) => setStudent(data.student)).catch(() => setError(true));
  }

  useEffect(loadStudent, [user.linkedId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!student) return;
    const mySubjectIds = subjects.filter((s) => s.course === student.course && s.semester === student.semester).map((s) => s.id);
    client
      .get("/timetable")
      .then(({ data }) => setEntries(data.timetable.filter((t) => mySubjectIds.includes(t.subject))))
      .catch(() => setError(true));
  }, [student, subjects]);

  if (error) return <ErrorState full message="Couldn't load your timetable. Please check your connection and try again." onRetry={loadStudent} />;
  if (!entries) return <Loader full label="Loading your timetable…" />;
  return <TimetableGrid entries={entries} />;
}
