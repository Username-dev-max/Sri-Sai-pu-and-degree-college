import { useState } from "react";
import { useData } from "../context/DataContext";
import GenericCrudPage from "../components/GenericCrudPage";
import Tabs from "../components/Tabs";

const TABS = [{ key: "courses", label: "Courses" }, { key: "subjects", label: "Subjects" }];

export default function Academics() {
  const [tab, setTab] = useState("courses");
  const { departments, courses, faculty, deptName, courseName } = useData();

  return (
    <div>
      <div className="mb-5">
        <Tabs tabs={TABS} active={tab} onChange={setTab} layoutId="academics-tab" />
      </div>

      {tab === "courses" ? (
        <GenericCrudPage
          title="Courses"
          endpoint="/courses"
          collectionKey="courses"
          columns={[
            { key: "id", label: "ID" },
            { key: "name", label: "Course Name" },
            { key: "department", label: "Department", render: (r) => deptName(r.department) },
            { key: "duration", label: "Duration" },
            { key: "semesters", label: "Semesters" },
          ]}
          fields={[
            { name: "name", label: "Course Name", type: "text", required: true },
            { name: "department", label: "Department", type: "select", required: true, options: departments.map((d) => ({ value: d.id, label: d.name })) },
            { name: "duration", label: "Duration", type: "text", required: true, default: "3 Years" },
            { name: "semesters", label: "Number of Semesters", type: "number", required: true, default: 6 },
          ]}
        />
      ) : (
        <GenericCrudPage
          title="Subjects"
          endpoint="/subjects"
          collectionKey="subjects"
          columns={[
            { key: "id", label: "ID" },
            { key: "name", label: "Subject Name" },
            { key: "course", label: "Course", render: (r) => courseName(r.course) },
            { key: "semester", label: "Sem" },
            { key: "credits", label: "Credits" },
            { key: "faculty", label: "Faculty", render: (r) => faculty.find((f) => f.id === r.faculty)?.name || r.faculty },
          ]}
          fields={[
            { name: "name", label: "Subject Name", type: "text", required: true },
            { name: "course", label: "Course", type: "select", required: true, options: courses.map((c) => ({ value: c.id, label: c.name })) },
            { name: "semester", label: "Semester", type: "number", required: true, default: 1 },
            { name: "credits", label: "Credits", type: "number", required: true, default: 3 },
            { name: "faculty", label: "Faculty", type: "select", required: true, options: faculty.map((f) => ({ value: f.id, label: f.name })) },
          ]}
        />
      )}
    </div>
  );
}
