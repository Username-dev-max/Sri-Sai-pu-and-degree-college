import GenericCrudPage from "../components/GenericCrudPage";

export default function TeamsAdmin() {
  const fields = [
    { name: "name", label: "Team Name", type: "text", required: true },
    { name: "description", label: "Team Description", type: "textarea" },
  ];
  const columns = [
    { key: "id", label: "ID" },
    { key: "name", label: "Name" },
    { key: "description", label: "Description" },
  ];
  return (
    <GenericCrudPage
      title="Teams"
      endpoint="/teams"
      collectionKey="teams"
      columns={columns}
      fields={fields}
    />
  );
}
