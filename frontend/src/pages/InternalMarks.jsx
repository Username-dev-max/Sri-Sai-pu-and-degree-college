import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import useAcademicScope from "../hooks/useAcademicScope";
import Tabs from "../components/Tabs";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import MarksSheet from "../components/marks/MarksSheet";
import ClassPerformance from "../components/marks/ClassPerformance";
import ExamsManager from "../components/marks/ExamsManager";
import { Award } from "lucide-react";

/** Internal marks for Admin and Faculty. */
export default function InternalMarks() {
  const { user } = useAuth();
  const { scope, error, reload } = useAcademicScope();
  const [tab, setTab] = useState("sheet");

  if (error) return <ErrorState full message="Couldn't load the academic structure." onRetry={reload} />;
  if (!scope) return <Loader full label="Loading…" />;

  const isFaculty = user.role === "Faculty";
  const tabs = [
    { key: "sheet", label: isFaculty ? "Enter Marks" : "Enter & Review Marks" },
    ...(!isFaculty || scope.classTeacherOf.length ? [{ key: "class", label: "Class Performance" }] : []),
    ...(user.role === "Admin" ? [{ key: "exams", label: "Exams" }] : []),
  ];

  if (isFaculty && scope.teachable.length === 0 && scope.classTeacherOf.length === 0) {
    return <EmptyState icon={Award} title="No subjects assigned to you" description="An administrator must assign you a subject before you can enter marks." />;
  }

  return (
    <div className="space-y-4">
      <Tabs tabs={tabs} active={tab} onChange={setTab} layoutId="marks-tabs" />
      {tab === "sheet" && <MarksSheet scope={scope} />}
      {tab === "class" && <ClassPerformance scope={scope} />}
      {tab === "exams" && <ExamsManager scope={scope} />}
    </div>
  );
}
