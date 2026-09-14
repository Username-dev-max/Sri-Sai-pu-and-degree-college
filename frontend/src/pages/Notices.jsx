import { useAuth } from "../context/AuthContext";
import GenericCrudPage from "../components/GenericCrudPage";
import StatusBadge from "../components/StatusBadge";
import { CATEGORY_TONE } from "./NoticesView";

export default function Notices() {
  const { user } = useAuth();
  return (
    <GenericCrudPage
      title="Notices"
      endpoint="/notices"
      collectionKey="notices"
      columns={[
        { key: "title", label: "Title" },
        { key: "category", label: "Category", render: (row) => <StatusBadge tone={CATEGORY_TONE[row.category] || "neutral"}>{row.category}</StatusBadge> },
        { key: "date", label: "Date" },
        { key: "postedBy", label: "Posted By" },
      ]}
      fields={[
        { name: "title", label: "Title", type: "text", required: true },
        { name: "category", label: "Category", type: "select", required: true, options: [
          { value: "General", label: "General" }, { value: "Exam", label: "Exam" },
          { value: "Holiday", label: "Holiday" }, { value: "Assignment", label: "Assignment" }, { value: "Important", label: "Important" },
        ] },
        { name: "date", label: "Date", type: "date", required: true, default: new Date().toISOString().slice(0, 10) },
        { name: "postedBy", label: "Posted By", type: "text", required: true, default: user.name },
        { name: "body", label: "Notice Body", type: "textarea", required: true },
      ]}
      searchKeys={["title", "category", "postedBy"]}
    />
  );
}
