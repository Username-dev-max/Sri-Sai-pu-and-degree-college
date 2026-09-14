import { useData } from "../context/DataContext";
import GenericCrudPage from "../components/GenericCrudPage";

export default function Exams() {
  const { subjects, subjectName } = useData();
  return (
    <GenericCrudPage
      title="Examinations"
      endpoint="/exams"
      collectionKey="exams"
      columns={[
        { key: "type", label: "Type" },
        { key: "subject", label: "Subject", render: (r) => subjectName(r.subject) },
        { key: "date", label: "Date" },
        { key: "time", label: "Time" },
        { key: "room", label: "Room" },
      ]}
      fields={[
        { name: "type", label: "Exam Type", type: "select", required: true, options: [
          { value: "Internal Assessment I", label: "Internal Assessment I" },
          { value: "Internal Assessment II", label: "Internal Assessment II" },
          { value: "Semester End Examination", label: "Semester End Examination" },
          { value: "Practical Examination", label: "Practical Examination" },
        ] },
        { name: "subject", label: "Subject", type: "select", required: true, options: subjects.map((s) => ({ value: s.id, label: s.name })) },
        { name: "date", label: "Date", type: "date", required: true },
        { name: "time", label: "Time", type: "text", required: true, default: "10:00 AM - 11:00 AM" },
        { name: "room", label: "Room", type: "text", required: true },
      ]}
      searchKeys={["type", "room", "date"]}
    />
  );
}
