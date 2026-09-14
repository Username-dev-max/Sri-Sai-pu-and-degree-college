import GenericCrudPage from "../components/GenericCrudPage";

export default function AcademicMeritAdmin() {
  const fields = [
    { name: "name", label: "Student Name", type: "text", required: true },
    { name: "marks", label: "Marks", type: "number", required: true },
    { name: "examLabel", label: "Exam Label", type: "text", required: true, default: "II PUC Annual Examination — April 2022" },
    { name: "detail", label: "Detail", type: "text", placeholder: "e.g. course or combination — optional" },
  ];
  const columns = [
    { key: "name", label: "Name" },
    { key: "marks", label: "Marks" },
    { key: "examLabel", label: "Exam" },
    { key: "detail", label: "Detail" },
  ];
  return (
    <GenericCrudPage
      title="Academic Merit List"
      endpoint="/academic-merit"
      collectionKey="academicMerit"
      columns={columns}
      fields={fields}
    />
  );
}
