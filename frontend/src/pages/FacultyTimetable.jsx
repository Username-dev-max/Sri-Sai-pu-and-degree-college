import { useEffect, useState } from "react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import TimetableGrid from "../components/TimetableGrid";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";

export default function FacultyTimetable() {
  const { user } = useAuth();
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(false);

  function load() {
    setError(false);
    client
      .get("/timetable")
      .then(({ data }) => setEntries(data.timetable.filter((t) => t.faculty === user.linkedId)))
      .catch(() => setError(true));
  }

  useEffect(load, [user.linkedId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorState full message="Couldn't load your timetable. Please check your connection and try again." onRetry={load} />;
  if (!entries) return <Loader full label="Loading your timetable…" />;
  return <TimetableGrid entries={entries} />;
}
