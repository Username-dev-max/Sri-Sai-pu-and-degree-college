import GenericCrudPage from "../components/GenericCrudPage";

export default function Departments() {
  const fields = [
    { name: "name", label: "Department Name", type: "text", required: true },
    { name: "code", label: "Code", type: "text", required: true },
    { name: "hod", label: "Head of Department", type: "text" },
    { name: "vision", label: "Vision", type: "textarea" },
    { name: "mission", label: "Mission", type: "textarea" },
  ];
  const columns = [
    { key: "id", label: "ID" },
    { key: "name", label: "Name" },
    { key: "code", label: "Code" },
    { key: "hod", label: "HOD" },
  ];
  return (
    <GenericCrudPage
      title="Departments"
      endpoint="/departments"
      collectionKey="departments"
      columns={columns}
      fields={fields}
    />
  );
}
