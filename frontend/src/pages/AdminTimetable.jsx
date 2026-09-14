import { useData } from "../context/DataContext";
import GenericCrudPage from "../components/GenericCrudPage";

export default function AdminTimetable() {
  const { subjects, faculty, subjectName, facultyName } = useData();

  const fields = [
    { name: "day", label: "Day", type: "select", required: true, options: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((d) => ({ value: d, label: d })) },
    { name: "time", label: "Time Slot", type: "text", required: true, default: "9:00 - 10:00" },
    { name: "subject", label: "Subject", type: "select", required: true, options: subjects.map((s) => ({ value: s.id, label: s.name })) },
    { name: "faculty", label: "Faculty", type: "select", required: true, options: faculty.map((f) => ({ value: f.id, label: f.name })) },
    { name: "room", label: "Room", type: "text", required: true },
  ];

  const columns = [
    { key: "day", label: "Day" },
    { key: "time", label: "Time" },
    { key: "subject", label: "Subject", render: (r) => subjectName(r.subject) },
    { key: "faculty", label: "Faculty", render: (r) => facultyName(r.faculty) },
    { key: "room", label: "Room" },
  ];

  return (
    <GenericCrudPage
      title="Timetable Entries"
      endpoint="/timetable"
      collectionKey="timetable"
      columns={columns}
      fields={fields}
      searchKeys={["day", "room"]}
    />
  );
}
