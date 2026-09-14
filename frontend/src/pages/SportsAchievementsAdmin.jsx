import GenericCrudPage from "../components/GenericCrudPage";

export default function SportsAchievementsAdmin() {
  const fields = [
    { name: "year", label: "Year", type: "text", required: true },
    { name: "sport", label: "Sport", type: "text", required: true },
    { name: "category", label: "Category", type: "text" },
    { name: "level", label: "Achievement Level", type: "text", required: true },
  ];
  const columns = [
    { key: "year", label: "Year" },
    { key: "sport", label: "Sport" },
    { key: "category", label: "Category" },
    { key: "level", label: "Level" },
  ];
  return (
    <GenericCrudPage
      title="Sports Achievements"
      endpoint="/sports-achievements"
      collectionKey="sportsAchievements"
      columns={columns}
      fields={fields}
    />
  );
}
